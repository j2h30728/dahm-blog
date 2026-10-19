import { existsSync } from "node:fs";
import path from "node:path";
import type { PublishOptions } from "./schema.js";

export function findWorkspaceRoot(context: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  const env = context.env ?? process.env;
  let current = path.resolve(env.INIT_CWD ?? context.cwd ?? process.cwd());
  while (!existsSync(path.join(current, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error("pnpm workspace 루트를 찾을 수 없습니다.");
    current = parent;
  }
  return current;
}

export function parseCliArgs(
  argv: string[], context: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): PublishOptions {
  const root = findWorkspaceRoot(context);
  const options: PublishOptions = {
    outputDir: path.join(root, "apps/blog/src/content/posts"),
    assetOutputDir: path.join(root, "apps/blog/public/post-assets"),
    manifestPath: path.join(root, ".content-sync/publish-manifest.json"),
    publicLinkIndexPath: path.join(root, "apps/blog/src/content/public-link-index.json"),
    publicPostIndexPath: path.join(root, "apps/blog/src/content/public-post-index.json"),
    searchIndexPath: path.join(root, "apps/blog/public/search/index.json"),
    postModuleMapPath: path.join(root, "apps/blog/src/content/post-module-map.ts"),
  };
  const flags: Record<string, keyof PublishOptions> = {
    "--out": "outputDir", "--assets": "assetOutputDir", "--manifest": "manifestPath",
    "--public-index": "publicLinkIndexPath", "--public-post-index": "publicPostIndexPath",
    "--search-index": "searchIndexPath", "--post-module-map": "postModuleMapPath",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = flags[argv[index]];
    const value = argv[index + 1];
    if (!key || !value || value.startsWith("--")) {
      throw new Error(`지원하지 않거나 값이 없는 인자: ${argv[index]}. Notion API 입력만 지원합니다.`);
    }
    options[key] = path.resolve(root, value);
  }
  return options;
}
