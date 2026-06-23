import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) => data.published === true);
  return posts.sort((a, b) => {
    const dateDiff = b.data.date.valueOf() - a.data.date.valueOf();
    if (dateDiff !== 0) return dateDiff;
    return a.data.title.localeCompare(b.data.title);
  });
}

export function getSeriesPosts(posts: Post[], series: string): Post[] {
  return posts
    .filter((post) => post.data.series === series)
    .sort((a, b) => {
      const orderA = a.data.seriesOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.data.seriesOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.data.date.valueOf() - b.data.date.valueOf();
    });
}
