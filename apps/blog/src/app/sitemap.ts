import type { MetadataRoute } from "next";
import { getPublishedPosts, getSeriesEntries, getTagEntries, type Post } from "../lib/posts";
import { absoluteUrl, siteConfig } from "../lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts();
  const latestPostDate = getLatestPostDate(posts);
  const tags = getTagEntries(posts);
  const series = getSeriesEntries(posts);

  return [
    pageEntry(siteConfig.canonicalHomePath, latestPostDate, "weekly", 1),
    pageEntry("/tech/", latestPostDate, "weekly", 0.8),
    pageEntry("/life/", latestPostDate, "weekly", 0.8),
    pageEntry("/about/", latestPostDate, "monthly", 0.6),
    pageEntry("/series/", latestPostDate, "weekly", 0.7),
    pageEntry("/tags/", latestPostDate, "weekly", 0.7),
    ...posts.map((post) =>
      pageEntry(post.href, post.updated ?? post.date, "monthly", 0.8),
    ),
    ...series.map((entry) =>
      pageEntry(`/series/${entry.slug}/`, latestPostDate, "weekly", 0.6),
    ),
    ...tags.map((entry) =>
      pageEntry(`/tags/${entry.slug}/`, latestPostDate, "weekly", 0.5),
    ),
  ];
}

function pageEntry(
  path: string,
  lastModified: string,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified: new Date(lastModified),
    changeFrequency,
    priority,
  };
}

function getLatestPostDate(posts: Post[]): string {
  return posts.reduce((latest, post) => {
    const candidate = post.updated ?? post.date;
    return Date.parse(candidate) > Date.parse(latest) ? candidate : latest;
  }, posts[0]?.updated ?? posts[0]?.date ?? new Date().toISOString());
}
