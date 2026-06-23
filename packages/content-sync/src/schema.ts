export type NoteState = "draft" | "published" | "archived";
export type ResolutionStatus = "public" | "private" | "missing";

export interface HeadingNode {
  depth: 2 | 3;
  text: string;
  id: string;
}

export interface ResolvedReference {
  raw: string;
  target: string;
  status: ResolutionStatus;
  replacement?: string;
}

export interface ResolvedAsset {
  raw: string;
  sourcePath: string;
  outputPath?: string;
  publicPath?: string;
  status: ResolutionStatus;
}

export interface ContentModel {
  sourcePath: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  series: string;
  seriesOrder?: number;
  headings: HeadingNode[];
  outboundLinks: ResolvedReference[];
  assets: ResolvedAsset[];
  body: string;
  state: NoteState;
}

export interface ManifestEntry {
  sourcePath: string;
  outputPath?: string;
  slug?: string;
  state?: NoteState;
  sourceChecksum: string;
  outputChecksum?: string;
  copiedAssets: ResolvedAsset[];
  rewrittenLinks: ResolvedReference[];
  warnings: string[];
  errors: string[];
}

export interface PublishManifest {
  generatedAt: string;
  exportedPosts: ManifestEntry[];
  skippedPosts: ManifestEntry[];
  warnings: string[];
  errors: string[];
}

export interface TransformOptions {
  vaultRoot: string;
  sourceDir?: string;
  outputDir: string;
  assetOutputDir: string;
  assetPublicBase?: string;
  manifestPath?: string;
  preview?: boolean;
}

export interface ParsedNote {
  sourcePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ValidationResult<T> {
  value?: T;
  warnings: string[];
  errors: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
