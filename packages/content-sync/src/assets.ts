import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ResolvedAsset } from "./schema.js";
import { isWithin, toPosixPath } from "./utils.js";

export interface AssetRewriteOptions {
  sourcePath: string;
  vaultRoot: string;
  outputRoot: string;
  publicBase: string;
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
  let rewritten = body.replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (raw, target, alias) => {
    const alt = alias || path.basename(target, path.extname(target));
    return rewriteAsset(raw, alt, target, options, assets, errors);
  });

  rewritten = rewritten.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (raw, alt, target) => {
    return rewriteAsset(raw, alt, target, options, assets, errors);
  });

  return { body: rewritten, assets, errors };
}

function rewriteAsset(
  raw: string,
  alt: string,
  target: string,
  options: AssetRewriteOptions,
  assets: ResolvedAsset[],
  errors: string[],
): string {
    if (/^https?:\/\//.test(target) || target.startsWith("/assets/")) {
      return raw;
    }

    const resolved = resolveAssetPath(target, options.sourcePath, options.vaultRoot);
    if (isWithin(options.privateRoot, resolved)) {
      assets.push({ raw, sourcePath: resolved, status: "private" });
      errors.push(`Public note embeds private asset: ${target}`);
      return raw;
    }

    if (!existsSync(resolved)) {
      assets.push({ raw, sourcePath: resolved, status: "missing" });
      errors.push(`Missing asset: ${target}`);
      return raw;
    }

    const outputDir = path.join(options.outputRoot, options.slug);
    mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, path.basename(resolved));
    copyFileSync(resolved, outputPath);
    const publicPath = toPosixPath(path.posix.join(options.publicBase, options.slug, path.basename(resolved)));
    assets.push({
      raw,
      sourcePath: resolved,
      outputPath,
      publicPath,
      status: "public",
    });
    return `![${alt}](${publicPath})`;
}

function resolveAssetPath(target: string, sourcePath: string, vaultRoot: string): string {
  const cleanTarget = decodeURI(target).split("#")[0].split("?")[0];
  if (path.isAbsolute(cleanTarget)) {
    return cleanTarget;
  }

  const relativeToNote = path.resolve(path.dirname(sourcePath), cleanTarget);
  if (existsSync(relativeToNote)) {
    return relativeToNote;
  }

  return path.resolve(vaultRoot, cleanTarget);
}
