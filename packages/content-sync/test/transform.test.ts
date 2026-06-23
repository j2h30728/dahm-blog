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
  mkdirSync(published, { recursive: true });
  mkdirSync(assets, { recursive: true });

  writeFileSync(path.join(assets, "diagram.svg"), "<svg />");
  writeFileSync(
    path.join(published, "second.md"),
    `---\ntitle: "Second"\nslug: "second"\ndescription: "Second post."\ndate: "2026-06-24"\ntags: ["test"]\nseries: "Demo"\npublished: true\n---\n\n## Second heading\n\nBody.\n`,
  );
  writeFileSync(
    path.join(published, "first.md"),
    `---\ntitle: "First"\nslug: "first"\ndescription: "First post."\ndate: "2026-06-23"\ntags: ["test", "sync"]\nseries: "Demo"\npublished: true\n---\n\n## First heading\n\nSee [[second|the second post]].\n\n![[second|Embedded second post]]\n\n![[../assets/diagram.svg|Diagram]]\n`,
  );

  const first = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: publicAssets,
    manifestPath: path.join(root, "manifest.json"),
  });
  const second = transformVault({
    vaultRoot: root,
    sourceDir: published,
    outputDir: output,
    assetOutputDir: publicAssets,
    manifestPath: path.join(root, "manifest.json"),
  });

  assert.equal(first.exportedPosts.length, 2);
  assert.equal(first.errors.length, 0);
  assert.deepEqual(
    first.exportedPosts.map((entry) => entry.outputChecksum),
    second.exportedPosts.map((entry) => entry.outputChecksum),
  );

  const outputText = readFileSync(path.join(output, "first.mdx"), "utf8");
  assert.match(outputText, /\[the second post\]\(\/posts\/second\/\)/);
  assert.match(outputText, /<aside class="note-embed"><a href="\/posts\/second\/">Embedded second post<\/a><\/aside>/);
  assert.match(outputText, /!\[Diagram\]\(\/assets\/posts\/first\/diagram.svg\)/);
  assert.equal(existsSync(path.join(publicAssets, "first", "diagram.svg")), true);
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
