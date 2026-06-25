import linkIndexJson from "../content/public-link-index.json";
import graphIndexJson from "../content/public-graph-index.json";
import tagIndexJson from "../content/public-tag-index.json";

interface PublicLinkNode {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  tags: string[];
  aliases?: string[];
  href: string;
  headings: Array<{
    depth: number;
    id: string;
    text: string;
  }>;
}

interface PublicLinkEdge {
  sourceSlug: string;
  targetSlug: string;
  kind: "none" | "heading" | "block";
  targetAnchor?: string;
  label: string;
}

interface PublicLinkIndex {
  nodes: PublicLinkNode[];
  edges: PublicLinkEdge[];
}

interface PublicGraphIndex {
  nodes: Array<{
    slug: string;
    title: string;
    href: string;
    tags: string[];
  }>;
  edges: PublicLinkEdge[];
}

interface PublicTagIndex {
  tags: Array<{
    tag: string;
    slugs: string[];
  }>;
}

export interface Backlink {
  source: PublicLinkNode;
  edge: PublicLinkEdge;
}

const linkIndex = linkIndexJson as PublicLinkIndex;
const graphIndex = graphIndexJson as PublicGraphIndex;
const tagIndex = tagIndexJson as PublicTagIndex;
const nodesBySlug = new Map(linkIndex.nodes.map((node) => [node.slug, node]));

export function getBacklinks(slug: string): Backlink[] {
  return linkIndex.edges
    .filter((edge) => edge.targetSlug === slug)
    .map((edge) => {
      const source = nodesBySlug.get(edge.sourceSlug);
      return source ? { source, edge } : null;
    })
    .filter((backlink): backlink is Backlink => backlink !== null);
}

export function getLinkPreviewPayload(): Record<
  string,
  Pick<PublicLinkNode, "title" | "description" | "excerpt" | "tags" | "href">
> {
  return Object.fromEntries(
    linkIndex.nodes.map((node) => [
      node.slug,
      {
        title: node.title,
        description: node.description,
        excerpt: node.excerpt,
        tags: node.tags,
        href: node.href,
      },
    ]),
  );
}

export function getPublicLinkNode(slug: string): PublicLinkNode | undefined {
  return nodesBySlug.get(slug);
}

export function getPublicGraph(): PublicGraphIndex {
  return graphIndex;
}

export function getPublicTagIndex(): PublicTagIndex {
  return tagIndex;
}

export function getPostsForTag(tag: string): PublicLinkNode[] {
  const slugs = tagIndex.tags.find((entry) => entry.tag === tag)?.slugs ?? [];
  return slugs.map((slug) => nodesBySlug.get(slug)).filter((node): node is PublicLinkNode => node !== undefined);
}
