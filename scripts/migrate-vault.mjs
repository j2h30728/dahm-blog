// Copies published Markdown sources and assets from an Obsidian vault into the
// repository-local content folder so the repo becomes the single source of truth.
//
// Usage:
//   pnpm migrate:vault
//   pnpm migrate:vault -- --vault "/path/to/Obsidian"
//   pnpm migrate:vault -- --dry-run
//
// Resolution order for the vault root (mirrors content-sync's cli-options):
//   1. --vault flag
//   2. OBSIDIAN_VAULT_PATH env var
//   3. (fails — migration needs an explicit vault source)

import { parseArgs } from "node:util";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { values } = parseArgs({
  options: {
    vault: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowNegative: true,
});

if (values.help) {
  console.log(`Usage: pnpm migrate:vault [-- --vault <path>] [-- --dry-run]

Copies <vault>/public/published/*.md -> repo content/public/published/
         <vault>/public/assets/*     -> repo content/public/assets/

--vault    Obsidian vault root (default: $OBSIDIAN_VAULT_PATH)
--dry-run  Print what would be copied without writing`);
  process.exit(0);
}

const vaultRoot = values.vault ?? process.env.OBSIDIAN_VAULT_PATH;

if (!vaultRoot) {
  console.error(
    "No vault specified. Set OBSIDIAN_VAULT_PATH or pass --vault <path>.\nSee: pnpm migrate:vault -- --help",
  );
  process.exit(1);
}

if (!existsSync(vaultRoot)) {
  console.error(`Vault root does not exist: ${vaultRoot}`);
  process.exit(1);
}

const pairs = [
  {
    label: "published posts",
    from: path.join(vaultRoot, "public/published"),
    to: path.join(repoRoot, "content/public/published"),
    filter: (name) => name.endsWith(".md"),
  },
  {
    label: "public assets",
    from: path.join(vaultRoot, "public/assets"),
    to: path.join(repoRoot, "content/public/assets"),
    filter: () => true,
  },
];

let copied = 0;
let skipped = 0;

for (const { label, from, to, filter } of pairs) {
  if (!existsSync(from)) {
    console.log(`Skip ${label}: source not found (${from})`);
    continue;
  }

  mkdirSync(to, { recursive: true });

  const entries = readdirSync(from).filter((name) => {
    const full = path.join(from, name);
    return statSync(full).isFile() && filter(name);
  });

  for (const name of entries) {
    const src = path.join(from, name);
    const dest = path.join(to, name);

    if (values["dry-run"]) {
      console.log(`[dry-run] ${src} -> ${dest}`);
      copied += 1;
      continue;
    }

    copyFileSync(src, dest);
    copied += 1;
  }
}

console.log(
  `\nMigrated ${copied} file(s)${skipped ? `, skipped ${skipped}` : ""}.` +
    (values["dry-run"] ? " (dry-run, nothing written)" : ""),
);
