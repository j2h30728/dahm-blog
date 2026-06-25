import path from "node:path";
import type { BlockAnchor, HeadingNode, ReferenceFragmentKind, ReferenceRole, ResolvedReference } from "./schema.js";
import { slugify } from "./utils.js";

export interface NoteIndexEntry {
  sourcePath: string;
  slug?: string;
  title?: string;
  description?: string;
  aliases?: string[];
  isPublic: boolean;
  headings?: HeadingNode[];
  blockAnchors?: BlockAnchor[];
}

export interface RewriteContext {
  sourceSlug: string;
  sourceTitle: string;
  sourcePath?: string;
}

export interface NoteIndex {
  entries: Map<string, NoteIndexEntry>;
  collisions: Map<string, NoteIndexEntry[]>;
}

const ASSET_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
  ".bmp",
  ".mp3",
  ".m4a",
  ".ogg",
  ".wav",
  ".flac",
  ".aac",
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".pdf",
]);

export function createNoteIndex(entries: NoteIndexEntry[]): NoteIndex {
  const index: NoteIndex = {
    entries: new Map<string, NoteIndexEntry>(),
    collisions: new Map<string, NoteIndexEntry[]>(),
  };
  for (const entry of entries) {
    const baseName = path.basename(entry.sourcePath, path.extname(entry.sourcePath));
    addIndexKey(index, baseName, entry);
    addIndexKey(index, path.basename(entry.sourcePath), entry);
    addIndexKey(index, entry.sourcePath, entry);
    if (entry.slug) {
      addIndexKey(index, entry.slug, entry);
    }
    for (const alias of entry.aliases ?? []) {
      addIndexKey(index, alias, entry);
    }
  }
  return index;
}

export function rewriteWikilinks(
  body: string,
  noteIndex: NoteIndex,
  context?: RewriteContext,
): {
  body: string;
  references: ResolvedReference[];
  errors: string[];
} {
  const references: ResolvedReference[] = [];
  const errors: string[] = [];

  const wikilinksRewritten = body.replace(/(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (raw, embed, targetSpec, alias) => {
    const parsed = parseReferenceTarget(String(targetSpec));
    if (embed && isAssetTarget(parsed.noteTarget)) {
      return raw;
    }

    const lookup = lookupNote(noteIndex, resolveLookupTarget(parsed, context));
    const role: ReferenceRole = embed ? "embed" : "link";
    const label = String(alias || parsed.fragment || parsed.noteTarget || context?.sourceTitle).trim();

    if (lookup.status === "ambiguous") {
      references.push(createReference({ raw, parsed, label, role, status: "missing", context }));
      errors.push(`Ambiguous note reference: ${raw}`);
      return raw;
    }

    if (lookup.status !== "found") {
      references.push(createReference({ raw, parsed, label, role, status: "missing", context }));
      errors.push(`Missing note reference: ${raw}`);
      return raw;
    }

    const entry = lookup.entry;
    if (!entry.isPublic || !entry.slug) {
      references.push(createReference({ raw, parsed, label, role, status: "private", context }));
      errors.push(`Public note references private note: ${raw}`);
      return raw;
    }

    const anchorResult = resolveTargetAnchor(parsed, entry);
    if (anchorResult.error) {
      references.push(
        createReference({
          raw,
          parsed,
          label,
          role,
          status: "missing",
          context,
          entry,
        }),
      );
      errors.push(`${anchorResult.error}: ${raw}`);
      return raw;
    }

    const href = `/posts/${entry.slug}/${anchorResult.anchor ?? ""}`;
    const replacement = embed
      ? `<aside class="note-embed"><a href="${href}">${escapeHtml(label)}</a></aside>`
      : `[${label}](${href})`;

    references.push(
      createReference({
        raw,
        parsed,
        label,
        role,
        status: "public",
        context,
        entry,
        replacement,
        targetAnchor: anchorResult.anchor,
      }),
    );
    return replacement;
  });

  const markdownLinksRewritten = rewriteMarkdownNoteLinks(wikilinksRewritten, noteIndex, context, references, errors);

  return { body: markdownLinksRewritten, references, errors };
}

interface ParsedReferenceTarget {
  noteTarget: string;
  fragmentKind: ReferenceFragmentKind;
  fragment?: string;
}

function parseReferenceTarget(value: string): ParsedReferenceTarget {
  const trimmed = value.trim();
  const headingIndex = trimmed.indexOf("#");
  const blockIndex = trimmed.lastIndexOf("^");

  if (headingIndex > -1 && (blockIndex === -1 || headingIndex < blockIndex)) {
    return {
      noteTarget: trimmed.slice(0, headingIndex).trim(),
      fragmentKind: "heading",
      fragment: trimmed.slice(headingIndex + 1).trim(),
    };
  }

  if (blockIndex > -1 && (headingIndex === -1 || blockIndex < headingIndex)) {
    return {
      noteTarget: trimmed.slice(0, blockIndex).trim(),
      fragmentKind: "block",
      fragment: trimmed.slice(blockIndex + 1).trim(),
    };
  }

  return {
    noteTarget: trimmed,
    fragmentKind: "none",
  };
}

function resolveLookupTarget(parsed: ParsedReferenceTarget, context: RewriteContext | undefined): string {
  return parsed.noteTarget || context?.sourcePath || "";
}

function parseMarkdownReferenceTarget(value: string, sourcePath: string | undefined): ParsedReferenceTarget | null {
  if (isExternalOrPageLink(value)) return null;

  const decoded = decodeURI(value.trim());
  const [targetWithoutQuery] = decoded.split("?", 1);
  const hashIndex = targetWithoutQuery.indexOf("#");
  const notePath = hashIndex === -1 ? targetWithoutQuery : targetWithoutQuery.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : targetWithoutQuery.slice(hashIndex + 1);
  if (!notePath || isAssetTarget(notePath)) return null;

  const extension = path.extname(notePath).toLowerCase();
  if (extension && extension !== ".md" && extension !== ".mdx") return null;

  const noteTarget = sourcePath && !path.isAbsolute(notePath)
    ? path.resolve(path.dirname(sourcePath), notePath)
    : notePath;

  if (!fragment) {
    return {
      noteTarget,
      fragmentKind: "none",
    };
  }

  if (fragment.startsWith("^")) {
    return {
      noteTarget,
      fragmentKind: "block",
      fragment: fragment.slice(1).trim(),
    };
  }

  return {
    noteTarget,
    fragmentKind: "heading",
    fragment: fragment.trim(),
  };
}

function resolveTargetAnchor(
  parsed: ParsedReferenceTarget,
  entry: NoteIndexEntry,
): {
  anchor?: string;
  error?: string;
} {
  if (parsed.fragmentKind === "none") return {};
  if (!parsed.fragment) {
    return { error: `Missing ${parsed.fragmentKind} reference target` };
  }

  if (parsed.fragmentKind === "heading") {
    const slug = slugify(parsed.fragment);
    const matches = (entry.headings ?? []).filter((heading) => {
      return (
        heading.id === parsed.fragment ||
        heading.id === slug ||
        heading.text.trim().toLowerCase() === parsed.fragment!.toLowerCase()
      );
    });
    if (matches.length === 0) return { error: `Missing heading reference` };
    if (matches.length > 1) return { error: `Ambiguous heading reference` };
    return { anchor: `#${matches[0].id}` };
  }

  const matches = (entry.blockAnchors ?? []).filter((block) => block.id === parsed.fragment);
  if (matches.length === 0) return { error: `Missing block reference` };
  if (matches.length > 1) return { error: `Ambiguous block reference` };
  return { anchor: `#${matches[0].anchor}` };
}

function createReference(input: {
  raw: string;
  parsed: ParsedReferenceTarget;
  label: string;
  role: ReferenceRole;
  status: ResolvedReference["status"];
  context?: RewriteContext;
  entry?: NoteIndexEntry;
  replacement?: string;
  targetAnchor?: string;
}): ResolvedReference {
  return {
    raw: input.raw,
    target: input.parsed.noteTarget,
    status: input.status,
    replacement: input.replacement,
    sourceSlug: input.context?.sourceSlug,
    sourceTitle: input.context?.sourceTitle,
    targetSlug: input.entry?.slug,
    targetTitle: input.entry?.title,
    targetDescription: input.entry?.description,
    label: input.label,
    fragmentKind: input.parsed.fragmentKind,
    targetAnchor: input.targetAnchor,
    role: input.role,
  };
}

function rewriteMarkdownNoteLinks(
  body: string,
  noteIndex: NoteIndex,
  context: RewriteContext | undefined,
  references: ResolvedReference[],
  errors: string[],
): string {
  return body.replace(/(?<!!)\[([^\]\n]+)\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g, (raw, label, targetSpec) => {
    const target = String(targetSpec).replace(/\s+"[^"]*"$/, "");
    const parsed = parseMarkdownReferenceTarget(target, context?.sourcePath);
    if (!parsed) return raw;

    const lookup = lookupNote(noteIndex, parsed.noteTarget);
    if (lookup.status === "ambiguous") {
      references.push(createReference({ raw, parsed, label: String(label), role: "link", status: "missing", context }));
      errors.push(`Ambiguous note reference: ${raw}`);
      return raw;
    }

    if (lookup.status !== "found") {
      references.push(createReference({ raw, parsed, label: String(label), role: "link", status: "missing", context }));
      errors.push(`Missing note reference: ${raw}`);
      return raw;
    }

    const entry = lookup.entry;
    if (!entry.isPublic || !entry.slug) {
      references.push(createReference({ raw, parsed, label: String(label), role: "link", status: "private", context }));
      errors.push(`Public note references private note: ${raw}`);
      return raw;
    }

    const anchorResult = resolveTargetAnchor(parsed, entry);
    if (anchorResult.error) {
      references.push(
        createReference({
          raw,
          parsed,
          label: String(label),
          role: "link",
          status: "missing",
          context,
          entry,
        }),
      );
      errors.push(`${anchorResult.error}: ${raw}`);
      return raw;
    }

    const href = `/posts/${entry.slug}/${anchorResult.anchor ?? ""}`;
    const replacement = `[${label}](${href})`;
    references.push(
      createReference({
        raw,
        parsed,
        label: String(label),
        role: "link",
        status: "public",
        context,
        entry,
        replacement,
        targetAnchor: anchorResult.anchor,
      }),
    );
    return replacement;
  });
}

function addIndexKey(index: NoteIndex, key: string, entry: NoteIndexEntry): void {
  const normalized = normalizeIndexKey(key);
  if (!normalized) return;

  const existing = index.entries.get(normalized);
  if (!existing) {
    index.entries.set(normalized, entry);
    return;
  }

  if (existing.sourcePath === entry.sourcePath) return;

  const collision = index.collisions.get(normalized) ?? [existing];
  if (!collision.some((item) => item.sourcePath === entry.sourcePath)) {
    collision.push(entry);
  }
  index.collisions.set(normalized, collision);
  index.entries.delete(normalized);
}

function lookupNote(index: NoteIndex, target: string): { status: "found"; entry: NoteIndexEntry } | { status: "missing" } | { status: "ambiguous" } {
  const normalized = normalizeIndexKey(target);
  if (!normalized) return { status: "missing" };
  if (index.collisions.has(normalized)) return { status: "ambiguous" };
  const entry = index.entries.get(normalized);
  return entry ? { status: "found", entry } : { status: "missing" };
}

function normalizeIndexKey(value: string): string {
  return decodeURI(value)
    .replace(/\\/g, "/")
    .replace(/\.mdx?$/i, "")
    .trim()
    .toLowerCase();
}

function isAssetTarget(target: string): boolean {
  return ASSET_EXTENSIONS.has(path.extname(target).toLowerCase());
}

function isExternalOrPageLink(target: string): boolean {
  return (
    /^([a-z][a-z0-9+.-]*:)?\/\//i.test(target) ||
    /^(mailto|tel|obsidian):/i.test(target) ||
    target.startsWith("#") ||
    target.startsWith("/")
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
