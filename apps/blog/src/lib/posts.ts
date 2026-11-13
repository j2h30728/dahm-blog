import { getCollection, type CollectionEntry } from 'astro:content';
import type { PostCategory } from './archive';
import { getTitDateParts } from './tit';
import manifest from '../content/export-manifest.json';

export type Entry = CollectionEntry<'posts'> | CollectionEntry<'notes'>;
export interface Post {
  entry: Entry;
  kind: 'posts' | 'notes';
  slug: string;
  href: string;
  title: string;
  description: string;
  excerpt: string;
  date: string;
  updated?: string;
  category: PostCategory;
  topic: string;
  tags: string[];
  series?: string;
  seriesOrder?: number;
}
export function plainText(body: string): string {
  return body.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[#*_`>~]/g, '').replace(/\s+/g, ' ').trim();
}
let buildPosts: Promise<Post[]> | undefined;
export function getPublishedPosts(): Promise<Post[]> {
  // A static build shares one collection read; dev always reads the current loader store.
  return import.meta.env.DEV ? readPublishedPosts() : (buildPosts ??= readPublishedPosts());
}
async function readPublishedPosts(): Promise<Post[]> {
  const groups = await Promise.all([
    manifest.entries.some(entry => entry.kind === 'posts') ? getCollection('posts') : Promise.resolve([]),
    manifest.entries.some(entry => entry.kind === 'notes') ? getCollection('notes') : Promise.resolve([]),
  ]);
  return groups.flat().filter(entry => entry.data.publish === true).map(entry => {
    const { data } = entry;
    const kind = entry.collection;
    const excerpt = plainText(entry.body ?? '').slice(0, 240);
    return {
      entry, kind, slug: data.slug, href: `/${kind}/${encodeURIComponent(data.slug)}/`,
      title: data.title, description: data.summary || excerpt, excerpt,
      date: data.date, updated: data.updated,
      category: data.section === '일상' ? 'life' as const : 'tech' as const,
      topic: data.tags[0] ?? '', tags: data.tags, series: data.series, seriesOrder: data.seriesOrder,
    };
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.title.localeCompare(b.title));
}
export function formatPostDate(value: string) {
  return getTitDateParts(value).dateLabel;
}
export const labelSlug = (label: string) => label.normalize('NFC').toLowerCase().replace(/['"]/g, '')
  .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
export function getLabels(posts: Post[], property: 'tags' | 'series') {
  const labels = new Set(posts.flatMap(post => property === 'tags' ? post.tags : post.series ? [post.series] : []));
  const names = [...labels].sort((a, b) => a.localeCompare(b));
  const slugs = new Set<string>();
  for (const name of names) {
    const slug = labelSlug(name);
    if (!slug || slugs.has(slug)) throw new Error(`태그/시리즈 주소가 중복되거나 비어 있습니다: ${name}`);
    slugs.add(slug);
  }
  return names.map(name => ({
    name, slug: labelSlug(name), posts: posts.filter(post => property === 'tags' ? post.tags.includes(name) : post.series === name),
  }));
}
export function getBacklinks(current: Post, posts: Post[]) {
  return posts.filter(post => post.href !== current.href && (post.entry.body ?? '').includes(current.href));
}
