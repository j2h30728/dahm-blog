import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { transformVault } from "./transform.js";

interface CliArgs {
  vaultRoot: string;
  sourceDir?: string;
  outputDir: string;
  assetOutputDir: string;
  manifestPath: string;
  preview: boolean;
}

const args = parseArgs(process.argv.slice(2));

try {
  const manifest = transformVault(args);
  console.log(`Exported ${manifest.exportedPosts.length} post(s).`);
  if (manifest.warnings.length > 0) {
    console.warn(`${manifest.warnings.length} warning(s). See manifest for details.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function parseArgs(argv: string[]): CliArgs {
  const root = findWorkspaceRoot();
  let sourceWasExplicit = Boolean(process.env.OBSIDIAN_PUBLIC_SOURCE);
  const vaultRoot = path.resolve(process.env.OBSIDIAN_VAULT_PATH ?? path.join(root, "content"));
  const defaults: CliArgs = {
    vaultRoot,
    sourceDir: path.resolve(process.env.OBSIDIAN_PUBLIC_SOURCE ?? path.join(vaultRoot, "public/published")),
    outputDir: path.resolve(root, "apps/blog/src/content/posts"),
    assetOutputDir: path.resolve(root, "apps/blog/public/assets/posts"),
    manifestPath: path.resolve(root, "apps/blog/src/content/publish-manifest.json"),
    preview: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--vault" && value) {
      defaults.vaultRoot = path.resolve(value);
      if (!sourceWasExplicit) {
        defaults.sourceDir = path.resolve(defaults.vaultRoot, "public/published");
      }
      index += 1;
    } else if (arg === "--source" && value) {
      defaults.sourceDir = path.resolve(value);
      sourceWasExplicit = true;
      index += 1;
    } else if (arg === "--out" && value) {
      defaults.outputDir = path.resolve(value);
      index += 1;
    } else if (arg === "--assets" && value) {
      defaults.assetOutputDir = path.resolve(value);
      index += 1;
    } else if (arg === "--manifest" && value) {
      defaults.manifestPath = path.resolve(value);
      index += 1;
    } else if (arg === "--preview") {
      defaults.preview = true;
    }
  }

  return defaults;
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
