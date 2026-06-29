export type NoteState = "draft" | "published" | "archived";
export type ResolutionStatus = "public" | "private" | "missing";
export type ReferenceFragmentKind = "none" | "heading" | "block";
export type ReferenceRole = "link" | "embed";
export type ParityClass = "exact" | "candidate" | "approximate" | "unsupported";
export type EmbedKind = "image" | "audio" | "video" | "pdf" | "file";

export interface HeadingNode {
  depth: 2 | 3;
  text: string;
  id: string;
}

export interface BlockAnchor {
  id: string;
  anchor: string;
}

export interface PublicProperty {
  name: string;
  type: "text" | "list" | "number" | "checkbox" | "date" | "datetime" | "tags";
  value: string | number | boolean | string[];
}

export interface TaskItem {
  marker: string;
  completed: boolean;
  text: string;
}

export interface CalloutDescriptor {
  type: string;
  title: string;
  fold?: "open" | "closed";
}

export interface EmbedDescriptor {
  raw: string;
  kind: EmbedKind;
  sourcePath: string;
  outputPath?: string;
  importPath?: string;
  publicPath?: string;
  status: ResolutionStatus;
  alt?: string;
  width?: number;
  height?: number;
  fragment?: string;
}

export interface ResolvedReference {
  raw: string;
  target: string;
  status: ResolutionStatus;
  replacement?: string;
  sourceSlug?: string;
  sourceTitle?: string;
  targetSlug?: string;
  targetTitle?: string;
  targetDescription?: string;
  label?: string;
  fragmentKind?: ReferenceFragmentKind;
  targetAnchor?: string;
  role?: ReferenceRole;
  /**
   * Internal-only diagnostic context for manifests and debugging.
   * Never include this field in public-link-index.json.
   */
  sourceContext?: {
    containerHeading?: string;
    surroundingText?: string;
  };
}

export interface ResolvedAsset {
  raw: string;
  sourcePath: string;
  outputPath?: string;
  importPath?: string;
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
  aliases: string[];
  cssclasses: string[];
  properties: PublicProperty[];
  series: string;
  seriesOrder?: number;
  headings: HeadingNode[];
  outboundLinks: ResolvedReference[];
  assets: ResolvedAsset[];
  embeds: EmbedDescriptor[];
  tasks: TaskItem[];
  callouts: CalloutDescriptor[];
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

export interface PublicLinkNode {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  tags: string[];
  aliases: string[];
  href: string;
  headings: HeadingNode[];
  properties?: PublicProperty[];
}

export interface PublicLinkEdge {
  sourceSlug: string;
  targetSlug: string;
  kind: ReferenceFragmentKind;
  targetAnchor?: string;
  label: string;
}

export interface PublicLinkIndex {
  generatedAt: string;
  nodes: PublicLinkNode[];
  edges: PublicLinkEdge[];
}

export interface PublicGraphIndex {
  generatedAt: string;
  nodes: Array<{
    slug: string;
    title: string;
    href: string;
    tags: string[];
  }>;
  edges: PublicLinkEdge[];
}

export interface PublicTagIndex {
  generatedAt: string;
  tags: Array<{
    tag: string;
    slugs: string[];
  }>;
}

export interface PublicPostIndexEntry {
  slug: string;
  href: string;
  title: string;
  description: string;
  excerpt: string;
  date: string;
  updated?: string;
  tags: string[];
  series: string;
  seriesSlug: string;
  seriesHref: string;
  seriesOrder?: number;
  headings: HeadingNode[];
}

export interface PublicPostIndex {
  generatedAt: string;
  posts: PublicPostIndexEntry[];
}

export interface PublicSearchIndexDocument {
  title: string;
  description: string;
  tags: string[];
  series: string;
  url: string;
  searchText: string;
}

export interface PublicSearchIndex {
  generatedAt: string;
  documents: PublicSearchIndexDocument[];
}

export interface TransformOptions {
  vaultRoot: string;
  sourceDir?: string;
  outputDir: string;
  assetOutputDir: string;
  manifestPath?: string;
  publicLinkIndexPath?: string;
  publicGraphIndexPath?: string;
  publicTagIndexPath?: string;
  publicPostIndexPath?: string;
  searchIndexPath?: string;
  postModuleMapPath?: string;
  jsxAttributes?: boolean;
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
