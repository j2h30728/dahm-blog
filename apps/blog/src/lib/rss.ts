import type { Post } from "./posts";
import { absoluteUrl, getSiteUrl, siteConfig } from "./site";

export function renderRssFeed(posts: Post[], siteUrl = getSiteUrl()): string {
  const baseUrl = siteUrl;
  const items = posts.map((post) => renderRssItem(post, baseUrl)).join("\n");
  const lastBuildDate = getLatestBuildDate(posts);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <description>${escapeXml(siteConfig.description)}</description>
    <link>${escapeXml(baseUrl)}</link>
    <language>${escapeXml(siteConfig.language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

function getLatestBuildDate(posts: Post[]): string {
  if (posts.length === 0) return new Date().toUTCString();
  const latest = posts.reduce((max, post) => {
    const time = Math.max(Date.parse(post.date), Date.parse(post.updated ?? post.date));
    return time > max ? time : max;
  }, 0);
  return new Date(latest).toUTCString();
}

function renderRssItem(post: Post, baseUrl: string): string {
  const link = `${baseUrl}${post.href}`;
  const categories = post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n");

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <link>${escapeXml(link)}</link>
      <guid>${escapeXml(link)}</guid>
${categories}
    </item>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
