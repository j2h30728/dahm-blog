import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCliArgs } from "../src/cli-options.js";

function createWorkspace(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "content-sync-cli-options-"));
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  mkdirSync(path.join(root, "apps/blog/src/content"), { recursive: true });
  return root;
}

test("defaults the diagnostic manifest to ignored operational state", () => {
  const root = createWorkspace();
  const args = parseCliArgs([], { cwd: root, env: {} });

  assert.equal(args.assetOutputDir, path.join(root, "apps/blog/public/post-assets"));
  assert.equal(args.manifestPath, path.join(root, ".content-sync/publish-manifest.json"));
  assert.equal(args.publicLinkIndexPath, path.join(root, "apps/blog/src/content/public-link-index.json"));
  assert.equal(args.publicGraphIndexPath, path.join(root, "apps/blog/src/content/public-graph-index.json"));
  assert.equal(args.publicTagIndexPath, path.join(root, "apps/blog/src/content/public-tag-index.json"));
});

test("allows explicit manifest path override", () => {
  const root = createWorkspace();
  const manifestPath = path.join(root, "tmp/custom-manifest.json");
  const args = parseCliArgs(["--manifest", manifestPath], { cwd: root, env: {} });

  assert.equal(args.manifestPath, manifestPath);
});

test("allows explicit public graph and tag index path overrides", () => {
  const root = createWorkspace();
  const graphPath = path.join(root, "tmp/custom-graph.json");
  const tagPath = path.join(root, "tmp/custom-tags.json");
  const args = parseCliArgs(["--public-graph-index", graphPath, "--public-tag-index", tagPath], { cwd: root, env: {} });

  assert.equal(args.publicGraphIndexPath, graphPath);
  assert.equal(args.publicTagIndexPath, tagPath);
});

test("allows explicit Next mirror artifact path overrides", () => {
  const root = createWorkspace();
  const postIndexPath = path.join(root, "tmp/public-post-index.json");
  const searchIndexPath = path.join(root, "tmp/search/index.json");
  const postModuleMapPath = path.join(root, "tmp/post-modules.generated.ts");
  const args = parseCliArgs(
    [
      "--public-post-index",
      postIndexPath,
      "--search-index",
      searchIndexPath,
      "--post-module-map",
      postModuleMapPath,
      "--jsx-attributes",
    ],
    { cwd: root, env: {} },
  );

  assert.equal(args.publicPostIndexPath, postIndexPath);
  assert.equal(args.searchIndexPath, searchIndexPath);
  assert.equal(args.postModuleMapPath, postModuleMapPath);
  assert.equal(args.jsxAttributes, true);
});

test("resolves relative explicit paths from the workspace root", () => {
  const root = createWorkspace();
  const packageCwd = path.join(root, "packages/content-sync");
  mkdirSync(packageCwd, { recursive: true });
  const args = parseCliArgs(
    [
      "--out",
      "apps/next-blog/src/content/posts",
      "--assets",
      "apps/next-blog/public/post-assets",
      "--manifest",
      ".content-sync/next-publish-manifest.json",
      "--post-module-map",
      "apps/next-blog/src/content/post-module-map.ts",
    ],
    { cwd: packageCwd, env: {} },
  );

  assert.equal(args.outputDir, path.join(root, "apps/next-blog/src/content/posts"));
  assert.equal(args.assetOutputDir, path.join(root, "apps/next-blog/public/post-assets"));
  assert.equal(args.manifestPath, path.join(root, ".content-sync/next-publish-manifest.json"));
  assert.equal(args.postModuleMapPath, path.join(root, "apps/next-blog/src/content/post-module-map.ts"));
});

test("keeps environment source explicit when vault changes later", () => {
  const root = createWorkspace();
  const source = path.join(root, "external-source");
  const vault = path.join(root, "other-vault");
  const args = parseCliArgs(["--vault", vault], {
    cwd: root,
    env: {
      OBSIDIAN_PUBLIC_SOURCE: source,
    },
  });

  assert.equal(args.vaultRoot, vault);
  assert.equal(args.sourceDir, source);
});
