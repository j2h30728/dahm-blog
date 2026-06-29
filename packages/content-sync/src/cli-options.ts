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
  publicPostIndexPath?: string;
  searchIndexPath?: string;
  postModuleMapPath?: string;
  jsxAttributes: boolean;
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
  const resolvePath = (value: string) => resolveWorkspacePath(root, value);
  let sourceWasExplicit = Boolean(env.OBSIDIAN_PUBLIC_SOURCE);
  const vaultRoot = env.OBSIDIAN_VAULT_PATH ? resolvePath(env.OBSIDIAN_VAULT_PATH) : path.join(root, "content");
  const defaults: CliArgs = {
    vaultRoot,
    sourceDir: env.OBSIDIAN_PUBLIC_SOURCE
      ? resolvePath(env.OBSIDIAN_PUBLIC_SOURCE)
      : path.join(vaultRoot, "public/published"),
    outputDir: path.resolve(root, "apps/blog/src/content/posts"),
    assetOutputDir: path.resolve(root, "apps/blog/public/post-assets"),
    manifestPath: path.resolve(root, ".content-sync/publish-manifest.json"),
    publicLinkIndexPath: path.resolve(root, "apps/blog/src/content/public-link-index.json"),
    publicGraphIndexPath: path.resolve(root, "apps/blog/src/content/public-graph-index.json"),
    publicTagIndexPath: path.resolve(root, "apps/blog/src/content/public-tag-index.json"),
    publicPostIndexPath: undefined,
    searchIndexPath: undefined,
    postModuleMapPath: undefined,
    jsxAttributes: false,
    preview: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--vault" && value) {
      defaults.vaultRoot = resolvePath(value);
      if (!sourceWasExplicit) {
        defaults.sourceDir = path.resolve(defaults.vaultRoot, "public/published");
      }
      index += 1;
    } else if (arg === "--source" && value) {
      defaults.sourceDir = resolvePath(value);
      sourceWasExplicit = true;
      index += 1;
    } else if (arg === "--out" && value) {
      defaults.outputDir = resolvePath(value);
      index += 1;
    } else if ((arg === "--assets" || arg === "--asset-source-out") && value) {
      defaults.assetOutputDir = resolvePath(value);
      index += 1;
    } else if (arg === "--manifest" && value) {
      defaults.manifestPath = resolvePath(value);
      index += 1;
    } else if (arg === "--public-index" && value) {
      defaults.publicLinkIndexPath = resolvePath(value);
      index += 1;
    } else if (arg === "--public-graph-index" && value) {
      defaults.publicGraphIndexPath = resolvePath(value);
      index += 1;
    } else if (arg === "--public-tag-index" && value) {
      defaults.publicTagIndexPath = resolvePath(value);
      index += 1;
    } else if (arg === "--public-post-index" && value) {
      defaults.publicPostIndexPath = resolvePath(value);
      index += 1;
    } else if (arg === "--search-index" && value) {
      defaults.searchIndexPath = resolvePath(value);
      index += 1;
    } else if (arg === "--post-module-map" && value) {
      defaults.postModuleMapPath = resolvePath(value);
      index += 1;
    } else if (arg === "--jsx-attributes") {
      defaults.jsxAttributes = true;
    } else if (arg === "--preview") {
      defaults.preview = true;
    }
  }

  return defaults;
}

function resolveWorkspacePath(root: string, value: string): string {
  return path.resolve(path.isAbsolute(value) ? value : path.join(root, value));
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
