import postIndexJson from "../content/public-post-index.json";
import { postModules, postModuleSlugs } from "../content/post-module-map";
import { slugify } from "./slug";

export interface Heading {
  depth: number;
  id: string;
  text: string;
}

export interface Post {
  slug: string;
  href: string;
  title: string;
  description: string;
  excerpt: string;
  date: string;
  updated?: string;
  topic: string;
  tags: string[];
  series: string;
  seriesSlug: string;
  seriesHref: string;
  seriesOrder?: number;
  headings: Heading[];
}

interface PublicPostIndex {
  posts: Post[];
}

const postIndex = postIndexJson as PublicPostIndex;
const postsBySlug = new Map(postIndex.posts.map((post) => [post.slug, post]));

export const allPostSlugs = postModuleSlugs;

export function getPublishedPosts(): Post[] {
  return [...postIndex.posts].sort(comparePostsByDateDesc);
}

export function getPost(slug: string): Post | undefined {
  return postsBySlug.get(slug);
}

export async function getPostContent(slug: string) {
  const load = postModules[slug];
  if (!load) return undefined;
  return load();
}

export function getSeriesPosts(posts: Post[], series: string): Post[] {
  return posts
    .filter((post) => post.series === series)
    .sort((a, b) => {
      const orderA = a.seriesOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.seriesOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return Date.parse(a.date) - Date.parse(b.date);
    });
}

export function getSeriesEntries(posts: Post[]): Array<{ name: string; slug: string; posts: Post[] }> {
  const entries = new Map<string, Post[]>();
  for (const post of posts) {
    entries.set(post.series, [...(entries.get(post.series) ?? []), post]);
  }

  return [...entries.entries()]
    .map(([name, seriesPosts]) => ({
      name,
      slug: seriesPosts[0]?.seriesSlug ?? "",
      posts: getSeriesPosts(seriesPosts, name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSeriesEntryBySlug(seriesSlug: string): { name: string; posts: Post[] } | undefined {
  const posts = getPublishedPosts();
  const match = posts.find((post) => post.seriesSlug === seriesSlug);
  if (!match) return undefined;
  return {
    name: match.series,
    posts: getSeriesPosts(posts, match.series),
  };
}

export function getTagPosts(posts: Post[], tag: string): Post[] {
  return posts.filter((post) => post.tags.includes(tag)).sort(comparePostsByDateDesc);
}

export function getTagEntries(posts: Post[]): Array<{ count: number; name: string; posts: Post[]; slug: string }> {
  const entries = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.tags) {
      entries.set(tag, [...(entries.get(tag) ?? []), post]);
    }
  }

  return [...entries.entries()]
    .map(([name, tagPosts]) => ({
      count: tagPosts.length,
      name,
      posts: getTagPosts(tagPosts, name),
      slug: slugify(name),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getTagEntryBySlug(tagSlug: string): { name: string; posts: Post[]; slug: string } | undefined {
  return getTagEntries(getPublishedPosts()).find((entry) => entry.slug === tagSlug);
}

export function getTopicEntries(posts: Post[]): Array<{ count: number; name: string }> {
  const entries = new Map<string, number>();
  for (const post of posts) {
    entries.set(post.topic, (entries.get(post.topic) ?? 0) + 1);
  }

  return [...entries.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function formatPostDate(value: string): string {
  return new Date(value).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function comparePostsByDateDesc(a: Post, b: Post): number {
  const dateDiff = Date.parse(b.date) - Date.parse(a.date);
  if (dateDiff !== 0) return dateDiff;
  return a.title.localeCompare(b.title);
}
