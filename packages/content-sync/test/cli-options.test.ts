import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCliArgs } from "../src/cli-options.js";

test("Notion 출력 경로는 workspace 루트를 기준으로 정한다", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "notion-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  const cwd = path.join(root, "packages/content-sync");
  mkdirSync(cwd, { recursive: true });
  const options = parseCliArgs([], { cwd, env: {} });
  assert.equal(options.outputDir, path.join(root, "apps/blog/src/content/posts"));
  assert.equal(options.assetOutputDir, path.join(root, "apps/blog/public/post-assets"));
  assert.equal(options.searchIndexPath, path.join(root, "apps/blog/public/search/index.json"));
  assert.equal(options.imageManifestPath, path.join(root, "apps/blog/src/content/image-manifest.json"));
  assert.equal("sourceDir" in options, false);
  const overridden = parseCliArgs(["--out", "tmp/posts", "--public-index", "tmp/links.json"], { cwd, env: {} });
  assert.equal(overridden.outputDir, path.join(root, "tmp/posts"));
  assert.equal(overridden.publicLinkIndexPath, path.join(root, "tmp/links.json"));
});

test("삭제한 입력 플래그와 모호한 인자는 파일 모드로 우회하지 않고 오류를 낸다", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "notion-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  for (const argv of [["--vault", "content"], ["--source", "content"], ["--preview"], ["--out"], ["--typo", "x"]]) {
    assert.throws(() => parseCliArgs(argv, { cwd: root, env: {} }), /지원하지 않거나/);
  }
});
