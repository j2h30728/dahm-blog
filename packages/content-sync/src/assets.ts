import { existsSync } from "node:fs";
import path from "node:path";
import type { ResolvedAsset } from "./schema.js";
import { isWithin, toPosixPath } from "./utils.js";

type PlannedAsset = ResolvedAsset & {
  outputPath: string;
  importPath: string;
  status: "public";
};

export interface AssetRewriteOptions {
  sourcePath: string;
  vaultRoot: string;
  outputRoot: string;
  markdownOutputPath: string;
  slug: string;
  privateRoot: string;
}

export function rewriteAssets(body: string, options: AssetRewriteOptions): {
  body: string;
  assets: ResolvedAsset[];
  errors: string[];
} {
  const assets: ResolvedAsset[] = [];
  const errors: string[] = [];
  const plannedAssets: PlannedAsset[] = [];

  let rewritten = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (raw, alt, target) => {
    return rewriteAsset(raw, alt, target, options, assets, plannedAssets, errors);
  });

  rewritten = rewritten.replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (raw, target, alias) => {
    const alt = alias || path.basename(target, path.extname(target));
    return rewriteAsset(raw, alt, target, options, assets, plannedAssets, errors);
  });

  assets.push(...plannedAssets);

  return { body: rewritten, assets, errors };
}

function rewriteAsset(
  raw: string,
  alt: string,
  target: string,
  options: AssetRewriteOptions,
  assets: ResolvedAsset[],
  plannedAssets: PlannedAsset[],
  errors: string[],
): string {
  if (/^https?:\/\//.test(target)) {
    return raw;
  }

  const resolved = resolveAssetPath(target, options.sourcePath, options.vaultRoot);
  if (isWithin(options.privateRoot, resolved)) {
    assets.push({ raw, sourcePath: resolved, status: "private" });
    errors.push(`Public note embeds private asset: ${target}`);
    return raw;
  }

  if (!isPublicAssetPath(resolved, options)) {
    assets.push({ raw, sourcePath: resolved, status: "private" });
    errors.push(`Public note embeds non-public asset: ${target}`);
    return raw;
  }

  if (!existsSync(resolved)) {
    assets.push({ raw, sourcePath: resolved, status: "missing" });
    errors.push(`Missing asset: ${target}`);
    return raw;
  }

  const outputDir = path.join(options.outputRoot, options.slug);
  const outputPath = path.join(outputDir, path.basename(resolved));
  const importPath = toPosixPath(path.relative(path.dirname(options.markdownOutputPath), outputPath));
  const conflictingAsset = plannedAssets.find((asset) => asset.outputPath === outputPath && asset.sourcePath !== resolved);
  if (conflictingAsset) {
    errors.push(`Duplicate asset output path: ${path.basename(resolved)}`);
    return raw;
  }

  plannedAssets.push({
    raw,
    sourcePath: resolved,
    outputPath,
    importPath,
    status: "public",
  });
  return `![${alt}](${importPath})`;
}

function isPublicAssetPath(resolved: string, options: AssetRewriteOptions): boolean {
  const publicAssetRoots = [
    path.join(options.vaultRoot, "public", "assets"),
    path.dirname(options.sourcePath),
  ];

  return publicAssetRoots.some((root) => isWithin(root, resolved));
}

function resolveAssetPath(target: string, sourcePath: string, vaultRoot: string): string {
  const cleanTarget = decodeURI(target).split("#")[0].split("?")[0];
  if (path.isAbsolute(cleanTarget)) {
    if (cleanTarget.startsWith("/assets/")) {
      return path.resolve(vaultRoot, "public", cleanTarget.slice(1));
    }
    return cleanTarget;
  }

  const relativeToNote = path.resolve(path.dirname(sourcePath), cleanTarget);
  if (existsSync(relativeToNote)) {
    return relativeToNote;
  }

  const relativeToVault = path.resolve(vaultRoot, cleanTarget);
  if (existsSync(relativeToVault)) {
    return relativeToVault;
  }

  return relativeToNote;
}
