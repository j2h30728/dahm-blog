import { getPublishedPosts, getLabels } from '../lib/posts';
import { absoluteUrl } from '../lib/site';
const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export async function GET() {
  const posts = await getPublishedPosts();
  const paths = ['/', '/tech/', '/life/', '/notes/', '/about/', '/tags/', '/series/', ...posts.map(post => post.href), ...getLabels(posts, 'tags').map(tag => `/tags/${encodeURIComponent(tag.slug)}/`), ...getLabels(posts, 'series').map(series => `/series/${encodeURIComponent(series.slug)}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${xml(absoluteUrl(path))}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
