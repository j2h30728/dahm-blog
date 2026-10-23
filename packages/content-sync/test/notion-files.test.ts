import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { notionMarkdown } from "../src/notion-markdown.js";
import type { ImageAsset } from "../src/schema.js";

const pageId = "11111111111111111111111111111111";
const zipBase = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page";

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "notion-file-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const attachmentResponse = (contentType = "application/zip") => new Response(new Uint8Array([80, 75, 3, 4]), {
  headers: { "content-type": contentType },
});

test("쌍 태그와 자기닫기 file은 이미지 처리 없이 영속화한 다운로드 링크로 만든다", async (t) => {
  const root = workspace(t);
  let imageCalls = 0;
  const result = await notionMarkdown([
    `<file src="${zipBase}/guide.zip?signature=paired">가이드 {예제} & 자료</file>`,
    `<file src="${zipBase}/source.zip?signature=self"/>`,
    `<file src="${zipBase}/handout.pdf?signature=pdf">PDF 자료</file>`,
  ].join("\n"), {
    workRoot: root,
    pageId,
    slugs: new Map(),
    fetcher: async (url) => attachmentResponse(url.includes(".pdf") ? "application/pdf" : "application/zip"),
    processImage: async () => {
      imageCalls++;
      throw new Error("일반 첨부파일을 이미지로 처리하면 안 됩니다.");
    },
  });

  assert.equal(imageCalls, 0);
  assert.match(result, /<a className="file-embed" href="\/post-assets\/notion\/.+\.zip">가이드 &#123;예제&#125; &amp; 자료<\/a>/);
  assert.match(result, /<a className="file-embed" href="\/post-assets\/notion\/.+\.zip">첨부파일<\/a>/);
  assert.match(result, /<a className="file-embed" href="\/post-assets\/notion\/.+\.pdf">PDF 자료<\/a>/);
  assert.doesNotMatch(result, /!\[/);
  assert.doesNotMatch(result, /signature=/);
});

test("실제 image는 이미지 처리 콜백을 사용하고 기존 미디어 임베드는 유지한다", async (t) => {
  const root = workspace(t);
  const sources: string[] = [];
  const optimized: ImageAsset = {
    src: "https://cdn.example.com/optimized.webp",
    originalSrc: "https://cdn.example.com/original.png",
    width: 640,
    height: 320,
    originalWidth: 1200,
    originalHeight: 600,
    variants: [{ src: "https://cdn.example.com/optimized.webp", width: 640 }],
  };
  const result = await notionMarkdown([
    '<image src="https://velog.velcdn.com/images/example/post.png">본문 이미지</image>',
    '<pdf src="https://example.com/guide.pdf">가이드 {문서}</pdf>',
    '<video src="https://example.com/movie.mp4">영상 {예제}</video>',
    '<audio src="https://example.com/sound.mp3">음원 {예제}</audio>',
  ].join("\n"), {
    workRoot: root,
    pageId,
    slugs: new Map(),
    processImage: async (source) => {
      sources.push(source);
      return optimized;
    },
  });

  assert.deepEqual(sources, ["https://velog.velcdn.com/images/example/post.png"]);
  assert.match(result, /!\[본문 이미지\]\(https:\/\/cdn\.example\.com\/optimized\.webp\)/);
  assert.match(result, /<iframe className="media-embed media-embed-pdf"/);
  assert.match(result, /<video className="media-embed media-embed-video" controls/);
  assert.match(result, /<audio className="media-embed media-embed-audio" controls/);
  assert.equal((result.match(/&#123;/g) ?? []).length, 3);
  assert.equal((result.match(/&#125;/g) ?? []).length, 3);
});

test("코드와 escape된 file 태그는 첨부파일로 해석하지 않는다", async (t) => {
  const root = workspace(t);
  let imageCalls = 0;
  const code = `\`\`\`html\n<file src="${zipBase}/code.zip">코드 예시</file>\n\`\`\``;
  const escaped = `\\<file src="${zipBase}/literal.zip">문자 그대로\\</file>`;
  const result = await notionMarkdown(`${code}\n${escaped}`, {
    workRoot: root,
    pageId,
    slugs: new Map(),
    fetcher: async () => { throw new Error("코드와 escape된 URL을 요청하면 안 됩니다."); },
    processImage: async () => {
      imageCalls++;
      throw new Error("코드와 escape된 태그를 이미지로 처리하면 안 됩니다.");
    },
  });

  assert.equal(imageCalls, 0);
  assert.ok(result.includes(code));
  assert.match(result, /&lt;file src="https:\/\/prod-files-secure\.s3\.us-west-2\.amazonaws\.com\/page\/literal\.zip">문자 그대로&lt;\/file>/);
});
