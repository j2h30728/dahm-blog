import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPostSocialImagePath, getSiteUrl } from "../src/lib/site.ts";
import { renderSocialImage } from "./lib/social-image.mjs";

// next.config가 읽는 환경 파일을 생성 스크립트에서도 동일하게 적용한다.
for (const name of ["../../../.env.local", "../../../.env"]) {
  try { process.loadEnvFile(fileURLToPath(new URL(name, import.meta.url))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const { posts } = JSON.parse(await readFile(new URL("../src/content/public-post-index.json", import.meta.url), "utf8"));
const hostname = new URL(getSiteUrl()).host;
// 정리 전에 모든 경로를 검증한다. 전용 생성 디렉터리 밖에는 쓰지 않는다.
const images = posts.map((post) => ({ post, imagePath: getPostSocialImagePath(post.slug) }));
await rm(path.join(publicRoot, "og/posts"), { recursive: true, force: true });
await mkdir(path.join(publicRoot, "og/posts"), { recursive: true });
await writeFile(path.join(publicRoot, "og/dahm.png"), await renderSocialImage({ hostname }));
for (const { post, imagePath } of images) {
  await writeFile(path.join(publicRoot, decodeURIComponent(imagePath)), await renderSocialImage({ title: post.title, hostname }));
}
console.log(`기본 OG 이미지와 공개 글 ${images.length}개 제목 이미지 생성 완료`);
