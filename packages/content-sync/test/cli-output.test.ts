import assert from "node:assert/strict";
import { test } from "node:test";
import { formatManifestPath, formatWarningSummary } from "../src/cli-output.js";

test("formats warning output with manifest path", () => {
  assert.equal(formatWarningSummary(2, "/tmp/manifest.json"), "2 warning(s). Manifest path: /tmp/manifest.json");
});

test("formats error output with manifest path", () => {
  assert.equal(formatManifestPath("/tmp/manifest.json"), "Manifest path: /tmp/manifest.json");
});
