import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const FORBIDDEN_MARKERS = [
  "content/private",
  "/private/",
  '"sourcePath"',
  '"replacement"',
  '"sourceContext"',
  '"raw"',
  '"resolvedPath"',
  '"privateRoot"',
  '"vaultRoot"',
  '"internalReferences"',
  '"diagnostics"',
  "%%",
  "PRIVATE COMMENT",
  "PRIVATE_NOTE_TITLE",
  "PRIVATE_NOTE_SLUG",
  "UNPUBLISHED_NOTE_TITLE",
  "UNPUBLISHED_BODY_TEXT",
  "DO_NOT_LEAK_PRIVATE_NOTE_TITLE",
  "file://",
  "obsidian://",
];

test("generated public artifacts do not expose private or internal markers", () => {
  const artifacts = [
    ...walkFiles(path.resolve("src/content/posts"), [".md", ".mdx"]),
    path.resolve("src/content/public-link-index.json"),
    path.resolve("src/content/public-graph-index.json"),
    path.resolve("src/content/public-tag-index.json"),
    path.resolve("public/search/index.json"),
    ...walkFiles(path.resolve("dist"), [".html", ".json", ".xml"]),
  ].filter((artifact) => existsSync(artifact));

  const offenders: Array<{ artifact: string; marker: string }> = [];
  for (const artifact of artifacts) {
    const text = readFileSync(artifact, "utf8");
    for (const marker of FORBIDDEN_MARKERS) {
      if (text.includes(marker)) {
        offenders.push({ artifact: path.relative(process.cwd(), artifact), marker });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

function walkFiles(root: string, extensions: string[]): string[] {
  if (!existsSync(root)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}
