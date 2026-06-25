import { existsSync } from "node:fs";
import path from "node:path";
import type { ResolvedAsset } from "./schema.js";
import { isWithin, toPosixPath } from "./utils.js";

type PlannedAsset = ResolvedAsset & {
  outputPath: string;
  importPath: string;
  status: "public";
};

interface ImageDescriptor {
  alt: string;
  width?: number;
  height?: number;
}

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
    return rewriteAsset(raw, parseImageDescriptor(alt, ""), target, options, assets, plannedAssets, errors);
  });

  rewritten = rewritten.replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (raw, target, alias) => {
    const defaultAlt = path.basename(target, path.extname(target));
    return rewriteAsset(raw, parseImageDescriptor(alias, defaultAlt), target, options, assets, plannedAssets, errors);
  });

  assets.push(...plannedAssets);

  return { body: rewritten, assets, errors };
}

function rewriteAsset(
  raw: string,
  image: ImageDescriptor,
  target: string,
  options: AssetRewriteOptions,
  assets: ResolvedAsset[],
  plannedAssets: PlannedAsset[],
  errors: string[],
): string {
  if (/^https?:\/\//.test(target)) {
    return hasExplicitSize(image) ? renderImageElement(target, image) : raw;
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
  return hasExplicitSize(image) ? renderImageElement(importPath, image) : `![${image.alt}](${importPath})`;
}

function parseImageDescriptor(label: string | undefined, defaultAlt: string): ImageDescriptor {
  const normalized = label?.trim() ?? "";
  if (!normalized) return { alt: defaultAlt };

  const parts = normalized.split("|").map((part) => part.trim());
  const size = parseImageSize(parts[parts.length - 1]);
  if (!size) return { alt: normalized };

  const alt = parts.slice(0, -1).join("|").trim() || defaultAlt;
  return { alt, ...size };
}

function parseImageSize(value: string | undefined): Pick<ImageDescriptor, "width" | "height"> | null {
  const match = value?.match(/^(\d{1,5})(?:px)?(?:\s*(?:x|×)\s*(\d{1,5})(?:px)?)?$/i);
  if (!match) return null;

  const width = toSafeDimension(match[1]);
  const height = match[2] ? toSafeDimension(match[2]) : undefined;
  if (!width || (match[2] && !height)) return null;

  return { width, height };
}

function toSafeDimension(value: string): number | undefined {
  const dimension = Number(value);
  return Number.isInteger(dimension) && dimension > 0 && dimension <= 10000 ? dimension : undefined;
}

function hasExplicitSize(image: ImageDescriptor): boolean {
  return image.width !== undefined || image.height !== undefined;
}

function renderImageElement(src: string, image: ImageDescriptor): string {
  const attributes = [
    `src="${escapeAttribute(src)}"`,
    `alt="${escapeAttribute(image.alt)}"`,
    image.width ? `width="${image.width}"` : "",
    image.height ? `height="${image.height}"` : "",
  ].filter(Boolean);

  return `<img ${attributes.join(" ")} />`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
