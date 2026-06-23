import linkIndexJson from "../content/public-link-index.json";

interface PublicLinkNode {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  tags: string[];
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

export interface Backlink {
  source: PublicLinkNode;
  edge: PublicLinkEdge;
}

const linkIndex = linkIndexJson as PublicLinkIndex;
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
