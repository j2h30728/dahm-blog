import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { transformVault } from "../src/transform.js";

test("exports published Obsidian notes with manifest, links, assets, and stable output", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-"));
  const published = path.join(root, "published");
  const assets = path.join(root, "assets");
  const output = path.join(root, "out");
  const publicAssets = path.join(root, "public-assets");
  const publicLinkIndex = path.join(root, "public-link-index.json");
  mkdirSync(published, { recursive: true });
  mkdirSync(assets, { recursive: true });

  writeFileSync(path.join(assets, "diagram.svg"), "<svg />");
  writeFileSync(
    path.join(published, "second.md"),
    `---\ntitle: "Second"\nslug: "second"\ndescription: "Second post."\ndate: "2026-06-24"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\n## Second heading\n\nBody. ^second-block\n`,
  );
  writeFileSync(
    path.join(published, "first.md"),
    `---\ntitle: "First"\nslug: "first"\ndescription: "First post."\ndate: "2026-06-23"\ntags: ["test", "sync"]\nseries: "Demo"\npublished: true\n---\n\n## First heading\n\nSee [[second|the second post]].\n\nSee [[second#Second heading|the second heading]].\n\nSee [[second^second-block|the second block]].\n\n![[second|Embedded second post]]\n\n![[../assets/diagram.svg|Diagram]]\n`,
  );

  const first = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: publicAssets,
    manifestPath: path.join(root, "manifest.json"),
    publicLinkIndexPath: publicLinkIndex,
  });
  const second = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: publicAssets,
    manifestPath: path.join(root, "manifest.json"),
    publicLinkIndexPath: publicLinkIndex,
  });

  assert.equal(first.exportedPosts.length, 2);
  assert.equal(first.errors.length, 0);
  assert.deepEqual(
    first.exportedPosts.map((entry) => entry.outputChecksum),
    second.exportedPosts.map((entry) => entry.outputChecksum),
  );

  const outputText = readFileSync(path.join(output, "first.mdx"), "utf8");
  assert.match(outputText, /\[the second post\]\(\/posts\/second\/\)/);
  assert.match(outputText, /\[the second heading\]\(\/posts\/second\/#second-heading\)/);
  assert.match(outputText, /\[the second block\]\(\/posts\/second\/#block-second-block\)/);
  assert.match(outputText, /<aside class="note-embed"><a href="\/posts\/second\/">Embedded second post<\/a><\/aside>/);
  assert.match(outputText, /!\[Diagram\]\(\/assets\/posts\/first\/diagram.svg\)/);
  assert.match(readFileSync(path.join(output, "second.mdx"), "utf8"), /<span id="block-second-block"><\/span>/);
  assert.equal(existsSync(path.join(publicAssets, "first", "diagram.svg")), true);

  const publicIndexText = readFileSync(publicLinkIndex, "utf8");
  const publicIndex = JSON.parse(publicIndexText) as {
    nodes: Array<{ slug: string; title: string; description: string; excerpt: string; tags: string[]; href: string }>;
    edges: Array<{ sourceSlug: string; targetSlug: string; kind: string; targetAnchor?: string; label: string }>;
  };
  assert.deepEqual(
    publicIndex.nodes.map((node) => node.slug),
    ["first", "second"],
  );
  assert.deepEqual(
    publicIndex.nodes.map((node) => [node.slug, node.excerpt, node.tags]),
    [
      ["first", "See the second post.", ["test", "sync"]],
      ["second", "Body.", ["test"]],
    ],
  );
  assert.deepEqual(
    publicIndex.edges.map((edge) => [edge.sourceSlug, edge.targetSlug, edge.kind, edge.targetAnchor, edge.label]),
    [
      ["first", "second", "none", undefined, "the second post"],
      ["first", "second", "heading", "#second-heading", "the second heading"],
      ["first", "second", "block", "#block-second-block", "the second block"],
    ],
  );
  assert.equal(publicIndexText.includes("sourcePath"), false);
  assert.equal(publicIndexText.includes("replacement"), false);
  assert.equal(publicIndexText.includes("sourceContext"), false);
  assert.equal(publicIndexText.includes("Embedded second post"), false);
});

test("fails closed when a public note references private notes or assets", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-private-"));
  const published = path.join(root, "published");
  const privateRoot = path.join(root, "private");
  const output = path.join(root, "out");
  const publicAssets = path.join(root, "public-assets");
  mkdirSync(published, { recursive: true });
  mkdirSync(privateRoot, { recursive: true });

  writeFileSync(path.join(privateRoot, "secret.md"), "---\ntitle: Secret\n---\n\nsecret");
  writeFileSync(path.join(privateRoot, "secret.svg"), "<svg />");
  writeFileSync(
    path.join(published, "leaky.md"),
    `---\ntitle: "Leaky"\nslug: "leaky"\ndescription: "Leaky post."\ndate: "2026-06-23"\ntags: ["privacy"]\nseries: "Demo"\npublished: true\n---\n\nSee [[secret]].\n\n![[../private/secret.svg|Secret]]\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: publicAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "leaky.mdx")), false);
});

test("fails closed when a public note references an absolute private asset path", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-absolute-private-"));
  const published = path.join(root, "published");
  const privateRoot = path.join(root, "private");
  const output = path.join(root, "out");
  const publicAssets = path.join(root, "public-assets");
  mkdirSync(published, { recursive: true });
  mkdirSync(privateRoot, { recursive: true });

  const secretAsset = path.join(privateRoot, "secret.svg");
  writeFileSync(secretAsset, "<svg />");
  writeFileSync(
    path.join(published, "absolute-leak.md"),
    `---\ntitle: "Absolute Leak"\nslug: "absolute-leak"\ndescription: "Absolute private path."\ndate: "2026-06-23"\ntags: ["privacy"]\nseries: "Demo"\npublished: true\n---\n\n![[${secretAsset}|Secret]]\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: publicAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "absolute-leak.mdx")), false);
});

test("fails closed when heading or block references cannot be resolved", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-missing-anchor-"));
  const published = path.join(root, "published");
  const output = path.join(root, "out");
  const publicAssets = path.join(root, "public-assets");
  mkdirSync(published, { recursive: true });

  writeFileSync(
    path.join(published, "target.md"),
    `---\ntitle: "Target"\nslug: "target"\ndescription: "Target post."\ndate: "2026-06-24"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\n## Existing heading\n\nBody. ^existing-block\n`,
  );
  writeFileSync(
    path.join(published, "source.md"),
    `---\ntitle: "Source"\nslug: "source"\ndescription: "Source post."\ndate: "2026-06-23"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\nSee [[target#Missing heading]].\n\nSee [[target^missing-block]].\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: publicAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "source.mdx")), false);
});

test("fails closed when a public note references a duplicate block id", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-duplicate-block-"));
  const published = path.join(root, "published");
  const output = path.join(root, "out");
  const publicAssets = path.join(root, "public-assets");
  mkdirSync(published, { recursive: true });

  writeFileSync(
    path.join(published, "target.md"),
    `---\ntitle: "Target"\nslug: "target"\ndescription: "Target post."\ndate: "2026-06-24"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\nFirst. ^duplicate\n\nSecond. ^duplicate\n`,
  );
  writeFileSync(
    path.join(published, "source.md"),
    `---\ntitle: "Source"\nslug: "source"\ndescription: "Source post."\ndate: "2026-06-23"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\nSee [[target^duplicate]].\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: publicAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "source.mdx")), false);
});

test("fails closed when a public note defines duplicate block ids without references", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-unreferenced-duplicate-block-"));
  const published = path.join(root, "published");
  const output = path.join(root, "out");
  const publicAssets = path.join(root, "public-assets");
  mkdirSync(published, { recursive: true });

  writeFileSync(
    path.join(published, "duplicate.md"),
    `---\ntitle: "Duplicate"\nslug: "duplicate"\ndescription: "Duplicate block ids."\ndate: "2026-06-24"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\nFirst. ^duplicate\n\nSecond. ^duplicate\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: publicAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "duplicate.mdx")), false);
});
