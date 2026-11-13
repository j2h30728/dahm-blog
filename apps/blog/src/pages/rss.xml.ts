import { getPublishedPosts } from '../lib/posts';
import { renderRssFeed } from '../lib/rss';
export async function GET() {
  return new Response(renderRssFeed(await getPublishedPosts()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
