export interface HeadingNode {
  depth: 2 | 3;
  text: string;
  id: string;
}

export interface NotionPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  updated: string;
  topic: string;
  tags: string[];
  series?: string;
  seriesOrder?: number;
  body: string;
}

export interface PostIndexEntry extends Omit<NotionPost, "id" | "body"> {
  tagSlugs: Record<string, string>;
  href: string;
  excerpt: string;
  headings: HeadingNode[];
  seriesSlug?: string;
  seriesHref?: string;
}

export interface LinkEdge {
  sourceSlug: string;
  targetSlug: string;
  kind: "none" | "heading";
  targetAnchor?: string;
  label: string;
}

export interface PublishOptions {
  outputDir: string;
  assetOutputDir: string;
  manifestPath: string;
  publicLinkIndexPath: string;
  publicPostIndexPath: string;
  searchIndexPath: string;
  postModuleMapPath: string;
}
