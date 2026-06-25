import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { transformVault } from "../src/transform.js";

test("exports published Obsidian notes with manifest, links, assets, and stable output", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-"));
  const publicRoot = path.join(root, "public");
  const published = path.join(publicRoot, "published");
  const assets = path.join(publicRoot, "assets");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
  const publicLinkIndex = path.join(root, "public-link-index.json");
  mkdirSync(published, { recursive: true });
  mkdirSync(assets, { recursive: true });

  writeFileSync(path.join(assets, "diagram.svg"), "<svg />");
  writeFileSync(path.join(assets, "manual.png"), "manual");
  mkdirSync(path.join(assets, "posts", "legacy"), { recursive: true });
  writeFileSync(path.join(assets, "posts", "legacy", "image.png"), "legacy");
  writeFileSync(
    path.join(published, "second.md"),
    `---\ntitle: "Second"\nslug: "second"\ndescription: "Second post."\ndate: "2026-06-24"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\n## Second heading\n\nBody. ^second-block\n`,
  );
  writeFileSync(
    path.join(published, "first.md"),
    `---\ntitle: "First"\nslug: "first"\ndescription: "First post."\ndate: "2026-06-23"\ntags: ["test", "sync"]\nseries: "Demo"\npublished: true\n---\n\n## First heading\n\nSee [[second|the second post]].\n\nSee [[second#Second heading|the second heading]].\n\nSee [[second^second-block|the second block]].\n\n![[second|Embedded second post]]\n\n![[../assets/diagram.svg|Diagram]]\n\n![Remote](https://example.com/remote.png)\n\n![Static](/assets/manual.png)\n\n![Legacy](/assets/posts/legacy/image.png)\n`,
  );

  const first = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: postAssets,
    manifestPath: path.join(root, "manifest.json"),
    publicLinkIndexPath: publicLinkIndex,
  });
  const second = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: postAssets,
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
  assert.match(outputText, /!\[Diagram\]\(\.\.\/post-assets\/first\/diagram.svg\)/);
  assert.match(outputText, /!\[Remote\]\(https:\/\/example.com\/remote.png\)/);
  assert.match(outputText, /!\[Static\]\(\.\.\/post-assets\/first\/manual.png\)/);
  assert.match(outputText, /!\[Legacy\]\(\.\.\/post-assets\/first\/image.png\)/);
  assert.equal(outputText.includes("/assets/posts"), false);
  assert.match(readFileSync(path.join(output, "second.mdx"), "utf8"), /<span id="block-second-block"><\/span>/);
  assert.equal(existsSync(path.join(postAssets, "first", "diagram.svg")), true);
  assert.equal(existsSync(path.join(postAssets, "first", "manual.png")), true);
  assert.equal(existsSync(path.join(postAssets, "first", "image.png")), true);
  const firstEntry = first.exportedPosts.find((entry) => entry.slug === "first");
  assert.deepEqual(
    firstEntry?.copiedAssets.map((asset) => asset.importPath).sort(),
    [
      "../post-assets/first/diagram.svg",
      "../post-assets/first/image.png",
      "../post-assets/first/manual.png",
    ],
  );

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

test("rewrites Obsidian image size aliases to responsive image attributes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-sized-images-"));
  const publicRoot = path.join(root, "public");
  const published = path.join(publicRoot, "published");
  const assets = path.join(publicRoot, "assets");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
  mkdirSync(published, { recursive: true });
  mkdirSync(assets, { recursive: true });

  writeFileSync(path.join(assets, "photo.png"), "photo");
  writeFileSync(path.join(assets, "frame.png"), "frame");
  writeFileSync(path.join(assets, "manual.png"), "manual");
  writeFileSync(
    path.join(published, "sized.md"),
    `---\ntitle: "Sized Images"\nslug: "sized"\ndescription: "Sized image post."\ndate: "2026-06-24"\ntags: ["images"]\nseries: "Demo"\npublished: true\n---\n\n![[../assets/photo.png|640]]\n\n![[../assets/frame.png|Frame diagram|480x270]]\n\n![Manual diagram|320](/assets/manual.png)\n`,
  );

  const result = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: postAssets,
  });

  assert.equal(result.errors.length, 0);
  const outputText = readFileSync(path.join(output, "sized.mdx"), "utf8");
  assert.match(outputText, /<img src="\.\.\/post-assets\/sized\/photo\.png" alt="photo" width="640" \/>/);
  assert.match(
    outputText,
    /<img src="\.\.\/post-assets\/sized\/frame\.png" alt="Frame diagram" width="480" height="270" \/>/,
  );
  assert.match(outputText, /<img src="\.\.\/post-assets\/sized\/manual\.png" alt="Manual diagram" width="320" \/>/);
  assert.equal(existsSync(path.join(postAssets, "sized", "photo.png")), true);
  assert.equal(existsSync(path.join(postAssets, "sized", "frame.png")), true);
  assert.equal(existsSync(path.join(postAssets, "sized", "manual.png")), true);
});

test("fails closed when a public note references private notes or assets", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-private-"));
  const published = path.join(root, "published");
  const privateRoot = path.join(root, "private");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
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
        assetOutputDir: postAssets,
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
  const postAssets = path.join(root, "post-assets");
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
        assetOutputDir: postAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "absolute-leak.mdx")), false);
});

test("fails closed when a public note references assets outside public roots", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-non-public-"));
  const publicRoot = path.join(root, "public");
  const published = path.join(publicRoot, "published");
  const publicAssets = path.join(publicRoot, "assets");
  const externalRoot = mkdtempSync(path.join(os.tmpdir(), "content-sync-external-"));
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
  mkdirSync(published, { recursive: true });
  mkdirSync(publicAssets, { recursive: true });
  mkdirSync(path.join(postAssets, "leaky"), { recursive: true });

  const externalAsset = path.join(externalRoot, "secret.png");
  writeFileSync(path.join(publicAssets, "safe.png"), "safe");
  writeFileSync(externalAsset, "secret");
  writeFileSync(path.join(postAssets, "leaky", "stale.png"), "stale");
  const relativeExternalAsset = path.relative(published, externalAsset).split(path.sep).join("/");
  writeFileSync(
    path.join(published, "leaky.md"),
    `---\ntitle: "Leaky"\nslug: "leaky"\ndescription: "Non-public assets."\ndate: "2026-06-23"\ntags: ["privacy"]\nseries: "Demo"\npublished: true\n---\n\n![[../assets/safe.png|Safe]]\n\n![[${externalAsset}|Absolute external]]\n\n![[${relativeExternalAsset}|Relative external]]\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: postAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "leaky.mdx")), false);
  assert.equal(existsSync(path.join(postAssets, "leaky", "stale.png")), false);
  assert.equal(existsSync(path.join(postAssets, "leaky", "safe.png")), false);
});

test("cleans all generated posts and assets when a later public note has blocking errors", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-global-failure-"));
  const publicRoot = path.join(root, "public");
  const published = path.join(publicRoot, "published");
  const publicAssets = path.join(publicRoot, "assets");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
  const publicLinkIndex = path.join(root, "public-link-index.json");
  mkdirSync(published, { recursive: true });
  mkdirSync(publicAssets, { recursive: true });
  mkdirSync(output, { recursive: true });
  mkdirSync(path.join(postAssets, "a-valid"), { recursive: true });

  writeFileSync(path.join(output, "stale.mdx"), "stale");
  writeFileSync(path.join(postAssets, "a-valid", "stale.png"), "stale");
  writeFileSync(publicLinkIndex, "stale");
  writeFileSync(path.join(publicAssets, "safe.png"), "safe");
  writeFileSync(
    path.join(published, "a-valid.md"),
    `---\ntitle: "Valid"\nslug: "a-valid"\ndescription: "Valid post."\ndate: "2026-06-23"\ntags: ["publishing"]\nseries: "Demo"\npublished: true\n---\n\n![[../assets/safe.png|Safe]]\n`,
  );
  writeFileSync(
    path.join(published, "z-invalid.md"),
    `---\ntitle: "Invalid"\nslug: "z-invalid"\ndescription: "Invalid post."\ndate: "2026-06-24"\ntags: ["publishing"]\nseries: "Demo"\npublished: true\n---\n\nSee [[missing-private-note]].\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: postAssets,
        publicLinkIndexPath: publicLinkIndex,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "a-valid.mdx")), false);
  assert.equal(existsSync(path.join(output, "stale.mdx")), false);
  assert.equal(existsSync(path.join(postAssets, "a-valid", "safe.png")), false);
  assert.equal(existsSync(path.join(postAssets, "a-valid", "stale.png")), false);
  assert.equal(existsSync(publicLinkIndex), false);
});

test("rolls back generated posts and assets when the staged copy phase fails", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-copy-failure-"));
  const publicRoot = path.join(root, "public");
  const published = path.join(publicRoot, "published");
  const publicAssets = path.join(publicRoot, "assets");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
  const manifestPath = path.join(root, "manifest.json");
  const publicLinkIndex = path.join(root, "public-link-index.json");
  mkdirSync(published, { recursive: true });
  mkdirSync(path.join(publicAssets, "bad.png"), { recursive: true });
  mkdirSync(output, { recursive: true });
  mkdirSync(path.join(postAssets, "copy-fails"), { recursive: true });

  writeFileSync(path.join(output, "stale.mdx"), "stale");
  writeFileSync(path.join(postAssets, "copy-fails", "stale.png"), "stale");
  writeFileSync(manifestPath, "stale");
  writeFileSync(publicLinkIndex, "stale");
  writeFileSync(
    path.join(published, "copy-fails.md"),
    `---\ntitle: "Copy Fails"\nslug: "copy-fails"\ndescription: "Copy failure rollback."\ndate: "2026-06-23"\ntags: ["publishing"]\nseries: "Demo"\npublished: true\n---\n\n![[../assets/bad.png|Bad]]\n`,
  );

  assert.throws(
    () =>
      transformVault({
        vaultRoot: root,
        sourceDir: published,
        outputDir: output,
        assetOutputDir: postAssets,
        manifestPath,
        publicLinkIndexPath: publicLinkIndex,
      }),
    /EISDIR|ENOTSUP|illegal operation|directory/,
  );
  assert.equal(existsSync(path.join(output, "copy-fails.mdx")), false);
  assert.equal(existsSync(path.join(output, "stale.mdx")), false);
  assert.equal(existsSync(path.join(postAssets, "copy-fails", "bad.png")), false);
  assert.equal(existsSync(path.join(postAssets, "copy-fails", "stale.png")), false);
  assert.equal(existsSync(manifestPath), false);
  assert.equal(existsSync(publicLinkIndex), false);
});

test("fails closed when heading or block references cannot be resolved", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-missing-anchor-"));
  const published = path.join(root, "published");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
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
        assetOutputDir: postAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "source.mdx")), false);
});

test("fails closed when a public note references a duplicate block id", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-duplicate-block-"));
  const published = path.join(root, "published");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
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
        assetOutputDir: postAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "source.mdx")), false);
});

test("fails closed when a public note defines duplicate block ids without references", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-unreferenced-duplicate-block-"));
  const published = path.join(root, "published");
  const output = path.join(root, "out");
  const postAssets = path.join(root, "post-assets");
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
        assetOutputDir: postAssets,
      }),
    /blocking error/,
  );
  assert.equal(existsSync(path.join(output, "duplicate.mdx")), false);
});
