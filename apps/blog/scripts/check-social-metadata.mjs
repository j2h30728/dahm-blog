import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPostSocialImagePath, siteConfig } from "../src/lib/site.ts";

const output = fileURLToPath(new URL("../out/", import.meta.url));
const { posts } = JSON.parse(readFileSync(new URL("../src/content/public-post-index.json", import.meta.url), "utf8"));
const postsByPath = new Map(posts.map((post) => [decodeURIComponent(post.href), post]));
const checkedImages = new Set();
const checkedPosts = new Set();

function decodeAttribute(value) {
  const entities = { amp: "&", quot: '"', lt: "<", gt: ">", apos: "'" };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|lt|gt|apos);/gi, (_, name) =>
    name.startsWith("#") ? String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : entities[name.toLowerCase()]);
}

function checkImage(imagePath) {
  if (checkedImages.has(imagePath)) return;
  const image = readFileSync(path.join(output, decodeURIComponent(imagePath)));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", imagePath);
  assert.equal(image.readUInt32BE(16), siteConfig.socialImage.width, imagePath);
  assert.equal(image.readUInt32BE(20), siteConfig.socialImage.height, imagePath);
  checkedImages.add(imagePath);
}
checkImage(siteConfig.socialImage.url);

let checked = 0;
for (const file of readdirSync(output, { recursive: true })) {
  if (!file.endsWith(".html")) continue;
  const html = readFileSync(path.join(output, file), "utf8");
  const metadata = new Map();
  for (const tag of html.matchAll(/<meta\s[^>]*>/g)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], decodeAttribute(match[2])]));
    metadata.set(attributes.property ?? attributes.name, attributes.content);
  }
  if (metadata.get("robots")?.includes("noindex")) continue;

  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
  assert.ok(canonical, `${file}: canonical이 없습니다.`);
  const post = postsByPath.get(decodeURIComponent(new URL(canonical[1]).pathname));
  const imagePath = post ? getPostSocialImagePath(post.slug) : siteConfig.socialImage.url;
  const imageUrl = new URL(imagePath, canonical[1]).href;
  const imageAlt = post ? post.title : siteConfig.socialImage.alt;
  checkImage(imagePath);
  if (post) checkedPosts.add(post.slug);
  assert.equal(metadata.get("og:image"), imageUrl, `${file}: OG 이미지 URL`);
  assert.equal(metadata.get("og:image:width"), String(siteConfig.socialImage.width), file);
  assert.equal(metadata.get("og:image:height"), String(siteConfig.socialImage.height), file);
  assert.equal(metadata.get("og:image:alt"), imageAlt, file);
  assert.equal(metadata.get("twitter:card"), "summary_large_image", file);
  assert.equal(metadata.get("twitter:image"), imageUrl, `${file}: Twitter 이미지 URL`);
  assert.equal(metadata.get("twitter:image:alt"), imageAlt, file);
  if (file === "index.html") {
    assert.equal(html.match(/<title>(.*?)<\/title>/s)?.[1], siteConfig.homeTitle);
    assert.equal(metadata.get("og:title"), siteConfig.homeTitle);
    assert.equal(metadata.get("twitter:title"), siteConfig.homeTitle);
  }
  checked++;
}
assert.ok(checked > 0, "검사할 정적 페이지가 없습니다.");
assert.equal(checkedPosts.size, posts.length, "모든 공개 글의 개별 OG 이미지를 확인해야 합니다.");
console.log(`정적 페이지 ${checked}개, 글별 OG ${checkedPosts.size}개, 기본 이미지 및 홈 제목 검증 통과`);
