import type { Post } from "./posts";

const siteDescription = "담의 글과 기록을 모아둔 공간입니다.";

export function renderRssFeed(posts: Post[], siteUrl = process.env.PUBLIC_SITE_URL ?? "https://example.com"): string {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const items = posts.map((post) => renderRssItem(post, baseUrl)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Dahm</title>
    <description>${escapeXml(siteDescription)}</description>
    <link>${escapeXml(baseUrl)}</link>
    <language>ko</language>
${items}
  </channel>
</rss>
`;
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
