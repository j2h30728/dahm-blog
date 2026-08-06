// Installs git hooks into .git/hooks/. Runs automatically on `pnpm install`.
//
// We write hooks directly (no husky/lefthook dependency) since the project only
// needs a pre-push check. Hooks are idempotent — re-running overwrites cleanly.

import { mkdirSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitDir = path.join(repoRoot, ".git");

if (!existsSync(gitDir)) {
  // Not a git checkout (e.g. npm pack). Skip silently.
  process.exit(0);
}

const hooksDir = path.join(gitDir, "hooks");
mkdirSync(hooksDir, { recursive: true });

const prePush = `#!/bin/sh
# Installed by scripts/install-hooks.mjs — do not edit by hand.
# Checks that the Obsidian vault and repo are in sync before pushing.
node "${path.join(repoRoot, "scripts/check-vault-sync.mjs")}"
`;

const hookPath = path.join(hooksDir, "pre-push");
writeFileSync(hookPath, prePush);
chmodSync(hookPath, 0o755);

console.log("git hook installed: pre-push (vault sync check)");
