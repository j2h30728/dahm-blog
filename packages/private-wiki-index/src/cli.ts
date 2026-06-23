import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { buildPrivateIndex } from "./index.js";

const args = process.argv.slice(2);
const root = findWorkspaceRoot();
const vaultRoot = readFlag(args, "--vault") ?? path.join(root, "content");
const outputPath = readFlag(args, "--out") ?? path.join(root, "packages/private-wiki-index/.private-index/index.json");
const include = readFlag(args, "--include")?.split(",") ?? ["private"];
const exclude = readFlag(args, "--exclude")?.split(",") ?? ["public"];

const index = buildPrivateIndex({
  vaultRoot: path.resolve(vaultRoot),
  include,
  exclude,
  outputPath: path.resolve(outputPath),
});

console.log(`Indexed ${index.documents.length} private document(s).`);

function readFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function findWorkspaceRoot(): string {
  let current = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : process.cwd();
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const packagePath = path.join(current, "package.json");
    if (existsSync(packagePath)) {
      try {
        const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as { workspaces?: unknown };
        if (Array.isArray(manifest.workspaces)) return current;
      } catch {
        // Keep walking upward.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}
