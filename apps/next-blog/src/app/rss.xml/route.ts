import { getPublishedPosts } from "../../lib/posts";
import { renderRssFeed } from "../../lib/rss";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderRssFeed(getPublishedPosts()), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}
