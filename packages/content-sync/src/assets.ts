import { existsSync } from "node:fs";
import path from "node:path";
import type { EmbedKind, ResolvedAsset } from "./schema.js";
import { isWithin, toPosixPath } from "./utils.js";

type PlannedAsset = ResolvedAsset & {
  outputPath: string;
  importPath: string;
  publicPath: string;
  status: "public";
};

interface ImageDescriptor {
  alt: string;
  width?: number;
  height?: number;
}

interface ParsedAssetTarget {
  path: string;
  fragment?: string;
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

  rewritten = rewritten.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (raw, target, alias) => {
    const parsedTarget = parseAssetTarget(target);
    const defaultAlt = path.basename(parsedTarget.path, path.extname(parsedTarget.path));
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
    return renderEmbed(target, "image", image);
  }

  const parsedTarget = parseAssetTarget(target);
  const resolved = resolveAssetPath(parsedTarget.path, options.sourcePath, options.vaultRoot);
  const kind = getEmbedKind(resolved);
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
  const publicPath = toPublicAssetPath(options.outputRoot, options.slug, path.basename(resolved));
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
    publicPath,
    status: "public",
  });
  const publicPathWithFragment = parsedTarget.fragment ? `${publicPath}#${parsedTarget.fragment}` : publicPath;
  return renderEmbed(publicPathWithFragment, kind, image, parsedTarget.fragment);
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

function renderEmbed(src: string, kind: EmbedKind, image: ImageDescriptor, fragment?: string): string {
  if (kind === "image") {
    return hasExplicitSize(image) ? renderImageElement(src, image) : `![${image.alt}](${src})`;
  }
  if (kind === "audio") {
    return `<audio class="media-embed media-embed-audio" controls src="${escapeAttribute(src)}">${escapeHtml(image.alt)}</audio>`;
  }
  if (kind === "video") {
    const dimensions = [
      image.width ? `width="${image.width}"` : "",
      image.height ? `height="${image.height}"` : "",
    ].filter(Boolean);
    const sizeAttributes = dimensions.length > 0 ? ` ${dimensions.join(" ")}` : "";
    return `<video class="media-embed media-embed-video" controls src="${escapeAttribute(src)}"${sizeAttributes}>${escapeHtml(image.alt)}</video>`;
  }
  if (kind === "pdf") {
    const height = parsePdfHeight(fragment) ?? image.height ?? 520;
    return `<iframe class="media-embed media-embed-pdf" src="${escapeAttribute(src)}" title="${escapeAttribute(image.alt)}" height="${height}"></iframe>`;
  }
  return `<a class="file-embed" href="${escapeAttribute(src)}">${escapeHtml(image.alt)}</a>`;
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

function parseAssetTarget(target: string): ParsedAssetTarget {
  const decoded = decodeURI(target);
  const [pathPart, fragment] = decoded.split("#", 2);
  return {
    path: pathPart.split("?")[0],
    fragment,
  };
}

function toPublicAssetPath(outputRoot: string, slug: string, fileName: string): string {
  const base = path.basename(outputRoot);
  return `/${[base, slug, fileName].map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function getEmbedKind(filePath: string): EmbedKind {
  const extension = path.extname(filePath).toLowerCase();
  if ([".apng", ".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp", ".bmp"].includes(extension)) {
    return "image";
  }
  if ([".mp3", ".m4a", ".ogg", ".wav", ".flac", ".aac"].includes(extension)) {
    return "audio";
  }
  if ([".mp4", ".m4v", ".mov", ".webm"].includes(extension)) {
    return "video";
  }
  if (extension === ".pdf") {
    return "pdf";
  }
  return "file";
}

function parsePdfHeight(fragment: string | undefined): number | undefined {
  const match = fragment?.match(/(?:^|&)height=(\d{1,5})(?:&|$)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 && value <= 10000 ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
