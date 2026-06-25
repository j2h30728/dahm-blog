import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts } from "../lib/posts";

const siteDescription = "담의 글과 기록을 모아둔 공간입니다.";

export async function GET(context: APIContext) {
  if (!context.site) {
    throw new Error("RSS feed requires `site` in astro.config.mjs.");
  }

  const posts = await getPublishedPosts();

  return rss({
    title: "Dahm",
    description: siteDescription,
    site: context.site,
    customData: "<language>ko</language>",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.data.slug}/`,
      categories: post.data.tags,
    })),
  });
}
