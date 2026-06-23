import path from "node:path";
import type { ResolvedReference } from "./schema.js";

export interface NoteIndexEntry {
  sourcePath: string;
  slug?: string;
  isPublic: boolean;
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
  }
  return index;
}

export function rewriteWikilinks(body: string, noteIndex: NoteIndex): {
  body: string;
  references: ResolvedReference[];
  errors: string[];
} {
  const references: ResolvedReference[] = [];
  const errors: string[] = [];

  const rewritten = body.replace(/(!)?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (raw, embed, target, alias) => {
    if (embed && isAssetTarget(target)) {
      return raw;
    }

    const normalizedTarget = String(target).trim().toLowerCase();
    const entry = noteIndex.get(normalizedTarget);
    const label = alias || target;

    if (!entry) {
      references.push({ raw, target, status: "missing" });
      errors.push(`Missing note reference: ${raw}`);
      return raw;
    }

    if (!entry.isPublic || !entry.slug) {
      references.push({ raw, target, status: "private" });
      errors.push(`Public note references private note: ${raw}`);
      return raw;
    }

    const replacement = embed
      ? `<aside class="note-embed"><a href="/posts/${entry.slug}/">${label}</a></aside>`
      : `[${label}](/posts/${entry.slug}/)`;
    references.push({ raw, target, status: "public", replacement });
    return replacement;
  });

  return { body: rewritten, references, errors };
}

function isAssetTarget(target: string): boolean {
  return ASSET_EXTENSIONS.has(path.extname(target).toLowerCase());
}
