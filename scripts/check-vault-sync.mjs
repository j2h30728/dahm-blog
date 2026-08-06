// Pre-push check: warn about vault posts missing from the repo.
//
// Runs automatically via .git/hooks/pre-push (installed by `pnpm install`).
// Skips silently when the vault isn't reachable (CI, other machines, or when
// OBSIDIAN_VAULT_PATH is unset), so it never blocks non-vault workflows.
//
// Exit codes:
//   0 — in sync (or vault unavailable, or SKIP_VAULT_CHECK set)
//   1 — vault has files the repo is missing; push aborted so you can sync first

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.SKIP_VAULT_CHECK === "1" || process.env.SKIP_VAULT_CHECK === "true") {
  process.exit(0);
}

const vaultRoot = process.env.OBSIDIAN_VAULT_PATH;

// No vault configured — nothing to compare against. Skip quietly.
if (!vaultRoot) {
  process.exit(0);
}

const vaultPublished = path.join(vaultRoot, "public/published");
const repoPublished = path.join(repoRoot, "content/public/published");

if (!existsSync(vaultPublished)) {
  // Vault path set but folder missing (e.g. Google Drive not mounted). Skip.
  process.exit(0);
}

if (!existsSync(repoPublished)) {
  console.error("pre-push: repo content/public/published/ not found — run pnpm migrate:vault first.");
  process.exit(1);
}

const listMd = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".md") && statSync(path.join(dir, name)).isFile())
    .sort();

const vaultFiles = new Set(listMd(vaultPublished));
const repoFiles = new Set(listMd(repoPublished));

const missing = [...vaultFiles].filter((name) => !repoFiles.has(name));

if (missing.length === 0) {
  process.exit(0);
}

console.warn(
  `\n⚠️  pre-push: ${missing.length} vault post(s) missing from the repo:\n`,
);
for (const name of missing) {
  console.warn(`  - ${name}`);
}
console.warn(
  `\nThe repo's content/public/published/ is the source of truth for Vercel.
Run \`pnpm migrate:vault\` to copy these in, then re-stage and push.
To bypass this check once: SKIP_VAULT_CHECK=1 git push\n`,
);
process.exit(1);
