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

  assert.equal(args.manifestPath, path.join(root, ".content-sync/publish-manifest.json"));
  assert.equal(args.publicLinkIndexPath, path.join(root, "apps/blog/src/content/public-link-index.json"));
});

test("allows explicit manifest path override", () => {
  const root = createWorkspace();
  const manifestPath = path.join(root, "tmp/custom-manifest.json");
  const args = parseCliArgs(["--manifest", manifestPath], { cwd: root, env: {} });

  assert.equal(args.manifestPath, manifestPath);
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
