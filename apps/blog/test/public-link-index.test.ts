import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getBacklinks, getLinkPreviewPayload, getPublicLinkNode } from "../src/lib/public-link-index";

test("public link index exposes backlinks and preview summaries", () => {
  const backlinks = getBacklinks("content-boundaries");

  assert.equal(backlinks.length, 3);
  assert.deepEqual(
    backlinks.map((backlink) => [backlink.source.slug, backlink.edge.kind, backlink.edge.label]),
    [
      ["hello-pipeline", "none", "content boundaries"],
      ["hello-pipeline", "heading", "the public allowlist"],
      ["hello-pipeline", "block", "the allowlist rule"],
    ],
  );
  assert.deepEqual(getBacklinks("hello-pipeline"), []);

  const node = getPublicLinkNode("content-boundaries");
  assert.equal(node?.title, "Content Boundaries");
  assert.equal(node?.description, "How public and private notes stay separated.");

  const previewPayload = getLinkPreviewPayload();
  assert.equal(previewPayload["content-boundaries"].title, "Content Boundaries");
  assert.equal(
    previewPayload["content-boundaries"].excerpt,
    "The export step accepts only notes in the published folder with published: true.",
  );
  assert.deepEqual(previewPayload["content-boundaries"].tags, ["architecture", "privacy"]);
  assert.equal(previewPayload["missing"], undefined);
});

test("public link index is consumed through the helper only", () => {
  const srcRoot = path.resolve("src");
  const offenders: string[] = [];

  for (const file of walkFiles(srcRoot)) {
    const normalized = file.split(path.sep).join("/");
    if (normalized.endsWith("src/lib/public-link-index.ts")) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes("public-link-index.json")) {
      offenders.push(normalized);
    }
  }

  assert.deepEqual(offenders, []);
});

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (/\.(astro|ts|tsx|js|mjs)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}
