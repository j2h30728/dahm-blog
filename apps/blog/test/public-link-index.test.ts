import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  getBacklinks,
  getLinkPreviewPayload,
  getPostsForTag,
  getPublicGraph,
  getPublicLinkNode,
  getPublicTagIndex,
} from "../src/lib/public-link-index";

test("public link index exposes backlinks and preview summaries", () => {
  assert.deepEqual(
    getBacklinks("openapi-generator-boundaries").map((backlink) => [backlink.source.slug, backlink.edge.kind, backlink.edge.label]),
    [
      ["obsidian-feature-showcase", "none", "OpenAPI Generator 글"],
      ["obsidian-feature-showcase", "heading", "CLI 섹션"],
      ["obsidian-feature-showcase", "heading", "API 타입 섹션"],
    ],
  );
  assert.deepEqual(getBacklinks("rsc-dot-notation-reexport"), []);

  const rscNode = getPublicLinkNode("rsc-dot-notation-reexport");
  assert.equal(rscNode?.title, "왜 RSC에서는 dot notation이 안 될까");
  assert.equal(
    rscNode?.description,
    "Next.js App Router와 RSC에서 Object.assign 기반 compound API가 깨지는 이유와 re-export namespace를 택한 배경.",
  );

  const openApiNode = getPublicLinkNode("openapi-generator-boundaries");
  assert.equal(openApiNode?.title, "OpenAPI Generator를 붙이며 나눈 경계");
  assert.equal(openApiNode?.headings[0]?.id, "api-타입을-옮겨-적는-비용");

  const previewPayload = getLinkPreviewPayload();
  assert.deepEqual(Object.keys(previewPayload).sort(), [
    "obsidian-feature-showcase",
    "openapi-generator-boundaries",
    "rsc-dot-notation-reexport",
  ]);
  assert.equal(previewPayload["obsidian-feature-showcase"].title, "Obsidian 기능 쇼케이스");
  assert.equal(previewPayload["openapi-generator-boundaries"].title, "OpenAPI Generator를 붙이며 나눈 경계");
  assert.match(previewPayload["openapi-generator-boundaries"].excerpt, /스웨거를 보며 API 타입을/);
  assert.deepEqual(previewPayload["openapi-generator-boundaries"].tags, ["openapi", "typescript", "codegen", "frontend"]);
  assert.equal(previewPayload["missing"], undefined);

  const graph = getPublicGraph();
  assert.deepEqual(
    graph.nodes.map((node) => node.slug).sort(),
    ["obsidian-feature-showcase", "openapi-generator-boundaries", "rsc-dot-notation-reexport"],
  );

  const tagIndex = getPublicTagIndex();
  assert.equal(tagIndex.tags.some((entry) => entry.tag === "openapi"), true);
  assert.deepEqual(
    getPostsForTag("obsidian").map((node) => node.slug),
    ["obsidian-feature-showcase"],
  );
});

test("public content indexes are consumed through the helper only", () => {
  const srcRoot = path.resolve("src");
  const offenders: string[] = [];
  const rawIndexImports = ["public-link-index.json", "public-graph-index.json", "public-tag-index.json"];

  for (const file of walkFiles(srcRoot)) {
    const normalized = file.split(path.sep).join("/");
    if (normalized.endsWith("src/lib/public-link-index.ts")) continue;
    const text = readFileSync(file, "utf8");
    if (rawIndexImports.some((rawIndexImport) => text.includes(rawIndexImport))) {
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
