import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildPrivateIndex } from "../src/index.js";

test("indexes only explicitly included private notes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "private-index-"));
  mkdirSync(path.join(root, "private"), { recursive: true });
  mkdirSync(path.join(root, "public"), { recursive: true });
  const outputPath = path.join(root, ".private-index", "index.json");

  writeFileSync(path.join(root, "private", "secret.md"), "---\ntitle: Secret\ntags: [llm]\n---\n\nprivate knowledge");
  writeFileSync(path.join(root, "public", "post.md"), "---\ntitle: Public\n---\n\npublic knowledge");

  const index = buildPrivateIndex({
    vaultRoot: root,
    include: ["private"],
    exclude: ["public"],
    outputPath,
  });

  assert.equal(index.documents.length, 1);
  assert.equal(index.documents[0].title, "Secret");
  assert.equal(index.documents[0].embedding.provider, "local-hash");
  assert.equal(existsSync(outputPath), true);
  assert.doesNotMatch(readFileSync(outputPath, "utf8"), /Public/);
});

test("refuses to write private index into the public blog directory", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "private-index-public-"));
  mkdirSync(path.join(root, "private"), { recursive: true });
  mkdirSync(path.join(root, "apps/blog/public/search"), { recursive: true });
  writeFileSync(path.join(root, "private", "secret.md"), "secret");

  assert.throws(
    () =>
      buildPrivateIndex({
        vaultRoot: root,
        include: ["private"],
        outputPath: path.join(root, "apps/blog/public/search/private.json"),
      }),
    /public blog directory/,
  );
});
