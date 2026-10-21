import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const { posts } = JSON.parse(readFileSync(path.join(root, "src/content/public-post-index.json"), "utf8"));
const routes = new Map(posts.map(post => [`posts/${post.slug}`, "content"]));
for (const post of posts) {
  for (const slug of Object.values(post.tagSlugs)) routes.set(`tags/${slug}`, "post-list");
  if (post.seriesSlug) routes.set(`series/${post.seriesSlug}`, "post-list");
}
const broken = [];
for (const [route, className] of routes) {
  const html = readFileSync(path.join(root, "out", route, "index.html"), "utf8");
  if (html.includes('<html id="__next_error__">') || !/<h1(?:\s[^>]*)?>/.test(html)
    || !new RegExp(`class="[^"]*\\b${className}\\b`).test(html)) broken.push(route);
}
assert.equal(broken.length, 0, `본문이 없는 정적 페이지: ${broken.join(", ")}`);
console.log(`정적 글·태그·시리즈 ${routes.size}개 본문 검증 통과`);
