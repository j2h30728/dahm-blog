import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPostSocialImagePath, getSiteUrl } from "../src/lib/site.ts";
import { renderSocialImage } from "./lib/social-image.mjs";

// Astro와 같은 우선순위: process.env > .env.local > .env.
for (const name of ["../../../.env.local", "../../../.env"]) {
  try {
    for (const [key, value] of Object.entries(parseEnv(await readFile(new URL(name, import.meta.url), "utf8")))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const { entries: posts } = JSON.parse(await readFile(new URL("../src/content/export-manifest.json", import.meta.url), "utf8"));
const hostname = new URL(getSiteUrl()).host;
// 정리 전에 모든 경로를 검증한다. 전용 생성 디렉터리 밖에는 쓰지 않는다.
const images = posts.map((post) => ({ post, imagePath: getPostSocialImagePath(post.slug, post.kind) }));
await rm(path.join(publicRoot, "og/posts"), { recursive: true, force: true });
await rm(path.join(publicRoot, "og/notes"), { recursive: true, force: true });
await mkdir(path.join(publicRoot, "og/posts"), { recursive: true });
await mkdir(path.join(publicRoot, "og/notes"), { recursive: true });
await writeFile(path.join(publicRoot, "og/dahm.png"), await renderSocialImage({ hostname }));
for (const { post, imagePath } of images) {
  await writeFile(path.join(publicRoot, decodeURIComponent(imagePath)), await renderSocialImage({ title: post.title, hostname }));
}
console.log(`기본 OG 이미지와 공개 글 ${images.length}개 제목 이미지 생성 완료`);
