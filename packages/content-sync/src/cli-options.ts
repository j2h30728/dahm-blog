import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface CliArgs {
  vaultRoot: string;
  sourceDir?: string;
  outputDir: string;
  assetOutputDir: string;
  manifestPath: string;
  publicLinkIndexPath: string;
  publicGraphIndexPath: string;
  publicTagIndexPath: string;
  preview: boolean;
}

type CliEnv = Record<string, string | undefined>;

interface CliOptionsContext {
  cwd?: string;
  env?: CliEnv;
}

export function parseCliArgs(argv: string[], context: CliOptionsContext = {}): CliArgs {
  const env = context.env ?? process.env;
  const root = findWorkspaceRoot(context);
  let sourceWasExplicit = Boolean(env.OBSIDIAN_PUBLIC_SOURCE);
  const vaultRoot = path.resolve(env.OBSIDIAN_VAULT_PATH ?? path.join(root, "content"));
  const defaults: CliArgs = {
    vaultRoot,
    sourceDir: path.resolve(env.OBSIDIAN_PUBLIC_SOURCE ?? path.join(vaultRoot, "public/published")),
    outputDir: path.resolve(root, "apps/blog/src/content/posts"),
    assetOutputDir: path.resolve(root, "apps/blog/public/post-assets"),
    manifestPath: path.resolve(root, ".content-sync/publish-manifest.json"),
    publicLinkIndexPath: path.resolve(root, "apps/blog/src/content/public-link-index.json"),
    publicGraphIndexPath: path.resolve(root, "apps/blog/src/content/public-graph-index.json"),
    publicTagIndexPath: path.resolve(root, "apps/blog/src/content/public-tag-index.json"),
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
    } else if ((arg === "--assets" || arg === "--asset-source-out") && value) {
      defaults.assetOutputDir = path.resolve(value);
      index += 1;
    } else if (arg === "--manifest" && value) {
      defaults.manifestPath = path.resolve(value);
      index += 1;
    } else if (arg === "--public-index" && value) {
      defaults.publicLinkIndexPath = path.resolve(value);
      index += 1;
    } else if (arg === "--public-graph-index" && value) {
      defaults.publicGraphIndexPath = path.resolve(value);
      index += 1;
    } else if (arg === "--public-tag-index" && value) {
      defaults.publicTagIndexPath = path.resolve(value);
      index += 1;
    } else if (arg === "--preview") {
      defaults.preview = true;
    }
  }

  return defaults;
}

export function findWorkspaceRoot(context: CliOptionsContext = {}): string {
  const env = context.env ?? process.env;
  let current = env.INIT_CWD ? path.resolve(env.INIT_CWD) : path.resolve(context.cwd ?? process.cwd());
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
    if (parent === current) return path.resolve(context.cwd ?? process.cwd());
    current = parent;
  }
}
