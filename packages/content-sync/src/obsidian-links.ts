import path from "node:path";
import type { BlockAnchor, HeadingNode, ReferenceFragmentKind, ReferenceRole, ResolvedReference } from "./schema.js";
import { slugify } from "./utils.js";

export interface NoteIndexEntry {
  sourcePath: string;
  slug?: string;
  title?: string;
  description?: string;
  isPublic: boolean;
  headings?: HeadingNode[];
  blockAnchors?: BlockAnchor[];
}

export interface RewriteContext {
  sourceSlug: string;
  sourceTitle: string;
}

export type NoteIndex = Map<string, NoteIndexEntry>;

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
  ".pdf",
]);

export function createNoteIndex(entries: NoteIndexEntry[]): NoteIndex {
  const index = new Map<string, NoteIndexEntry>();
  for (const entry of entries) {
    const baseName = path.basename(entry.sourcePath, path.extname(entry.sourcePath));
    index.set(baseName.toLowerCase(), entry);
    index.set(entry.sourcePath.toLowerCase(), entry);
    if (entry.slug) {
      index.set(entry.slug.toLowerCase(), entry);
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

  const rewritten = body.replace(/(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (raw, embed, targetSpec, alias) => {
    const parsed = parseReferenceTarget(String(targetSpec));
    if (embed && isAssetTarget(parsed.noteTarget)) {
      return raw;
    }

    const normalizedTarget = parsed.noteTarget.trim().toLowerCase();
    const entry = noteIndex.get(normalizedTarget);
    const role: ReferenceRole = embed ? "embed" : "link";
    const label = String(alias || parsed.fragment || parsed.noteTarget).trim();

    if (!entry) {
      references.push(createReference({ raw, parsed, label, role, status: "missing", context }));
      errors.push(`Missing note reference: ${raw}`);
      return raw;
    }

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

  return { body: rewritten, references, errors };
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

  if (blockIndex > 0) {
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

function isAssetTarget(target: string): boolean {
  return ASSET_EXTENSIONS.has(path.extname(target).toLowerCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
