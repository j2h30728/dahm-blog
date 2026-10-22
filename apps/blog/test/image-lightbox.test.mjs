import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { mdxOptions } from "../next.config.mjs";
import rehypePostImages from "../src/lib/rehype-post-images.mjs";

const require = createRequire(import.meta.url);
const loaderRequire = createRequire(require.resolve("@mdx-js/loader"));
const { evaluate } = await import(pathToFileURL(loaderRequire.resolve("@mdx-js/mdx")).href);

function compileModule(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const code = outputText.replace(/from "([^"]+)"/g, (_, name) =>
    `from ${JSON.stringify(imports[name] ?? (name.startsWith("node:") ? name : pathToFileURL(require.resolve(name)).href))}`);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

const imageModule = compileModule("../src/components/ZoomableImage.tsx");
const { useMDXComponents } = await import(compileModule("../src/mdx-components.tsx", {
  "./components/ZoomableImage": imageModule,
}));

async function render(markdown, overrides = {}, compileOptions = {}) {
  const { default: Content } = await evaluate(markdown, { ...mdxOptions, ...compileOptions, ...runtime });
  return renderToStaticMarkup(createElement(Content, { components: useMDXComponents(overrides) }));
}

test("노션 캡션의 너비를 적용하고 크기 표기는 alt·레이블·캡션에서 숨긴다", async () => {
  const { notionMarkdown } = await import(compileModule("../../../packages/content-sync/src/notion-markdown.ts", {
    "./utils.js": compileModule("../../../packages/content-sync/src/utils.ts"),
    "./notion-blocks.js": compileModule("../../../packages/content-sync/src/notion-blocks.ts"),
  }));
  for (const source of [
    "![로그인 화면 {width=360}](https://example.com/login.png)",
    '<image src="https://example.com/login.png">로그인 화면 {width=360}</image>',
  ]) {
    const mdx = await notionMarkdown(source, { workRoot: "/unused", pageId: "test", slugs: new Map() });
    const html = await render(mdx);
    assert.match(html, /class="post-image-frame"[^>]*style="width:360px"/);
    assert.match(html, /alt="로그인 화면"/);
    assert.match(html, /aria-label="로그인 화면 확대"/);
    assert.match(html, /class="post-image-caption">로그인 화면<\/span>/);
    assert.doesNotMatch(html, /width=360|&#123;|<figure|<div/);
  }
});

test("크기만 지정하면 빈 캡션을 만들지 않고 너비 생략은 자동 크기를 유지한다", async () => {
  const sized = await render("![&#123;width=360&#125;](/photo.png)");
  assert.match(sized, /style="width:360px"/);
  assert.match(sized, /alt=""/);
  assert.match(sized, /aria-label="본문 이미지 확대"/);
  assert.doesNotMatch(sized, /post-image-caption|width=360/);
  const automatic = await render("![설명](/photo.png)");
  assert.doesNotMatch(automatic, /style=|width="/);
  assert.match(automatic, /class="post-image-caption">설명<\/span>/);
});

test("이미지 링크의 캡션과 너비도 중첩 버튼 없이 적용한다", async () => {
  const html = await render("[![화면 &#123;width=360&#125;](/photo.png)](/original.png)");
  assert.match(html, /<a[^>]*href="\/original.png"[^>]*aria-haspopup="dialog"/);
  assert.match(html, /style="width:360px"/);
  assert.match(html, /alt="화면"/);
  assert.match(html, /post-image-caption">화면<\/span>/);
  assert.doesNotMatch(html, /<button|width=360/);
});

test("잘못된 너비나 캡션 중간 표현은 텍스트로 보존하고 일반 문장·코드를 해석하지 않는다", async () => {
  const { img: Image } = useMDXComponents({});
  for (const caption of ["{width=0}", "{width=-1}", "{width=1.5}", "{width=10001}", "{width=360px}", "{width=50%}", "{width=360} 예시"]) {
    const html = renderToStaticMarkup(createElement(Image, { src: "/photo.png", alt: caption }));
    assert.ok(html.includes(`alt="${caption}"`), caption);
    assert.doesNotMatch(html, /style=/);
  }
  const prose = await render("일반 문장 &#123;width=360&#125;\n\n`{width=360}`\n\n```text\n{width=360}\n```");
  assert.equal((prose.match(/\{width=360\}/g) ?? []).length, 3);
  assert.doesNotMatch(prose, /post-image-frame/);
});

test("문단의 모든 Markdown 이미지를 SSR 가능한 확대 버튼으로 렌더링한다", async () => {
  const html = await render("앞 문장\n![설계 그림](/diagram.png)\n뒤 문장\n\n![](https://example.com/photo.jpg)");
  assert.equal((html.match(/class="post-image-trigger"/g) ?? []).length, 2);
  assert.match(html, /<p>앞 문장<br\/>\s*<span class="post-image-frame"><button[^>]*aria-haspopup="dialog"[^>]*><img[^>]*alt="설계 그림"/);
  assert.match(html, /src="\/diagram.png"/);
  assert.match(html, /aria-label="본문 이미지 확대"/);
  assert.doesNotMatch(html, /<(?:dialog|figure|div)\b/);
});

test("이미지 링크는 중첩 버튼 없이 확대 링크로 렌더링하고 일반 링크는 보존한다", async () => {
  const html = await render("[![링크 사진](/photo.png)](/original.png)\n\n[일반 링크](/about/)");
  assert.match(html, /<a[^>]*href="\/original.png"[^>]*aria-haspopup="dialog"[^>]*><span class="post-image-frame"><img/);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /<a href="\/about\/">일반 링크<\/a>/);
});

test("이미지 속성을 보존하고 src 없는 이미지는 확대 버튼을 만들지 않는다", () => {
  const { img: Image } = useMDXComponents({});
  const html = renderToStaticMarkup(createElement(Image, {
    src: "/photo.png", alt: "사진", width: 640, height: 480,
    srcSet: "/small.png 320w, /photo.png 640w", sizes: "100vw", loading: "lazy",
  }));
  for (const attribute of ['width="640"', 'height="480"', 'srcSet="/small.png 320w, /photo.png 640w"', 'sizes="100vw"', 'loading="lazy"']) {
    assert.ok(html.includes(attribute), attribute);
  }
  const empty = renderToStaticMarkup(createElement(Image, { alt: "대체 텍스트" }));
  assert.match(empty, /<img alt="대체 텍스트"/);
  assert.doesNotMatch(empty, /button/);
});

test("호출자가 전달한 MDX 이미지·링크 컴포넌트가 우선한다", async () => {
  const html = await render("![그림](/photo.png)\n\n[링크](/about/)", {
    img: ({ alt }) => createElement("span", null, alt),
    a: ({ children }) => createElement("strong", null, children),
  });
  assert.match(html, /<span>그림<\/span>/);
  assert.match(html, /<strong>링크<\/strong>/);
  assert.doesNotMatch(html, /post-image-trigger/);
});

test("manifest 이미지에 반응형 본문 속성과 클릭 전용 원본 정보를 주입한다", async () => {
  const source = "https://cdn.example.com/hash/w960.webp";
  const original = "https://cdn.example.com/hash/original.png";
  const manifest = {
    version: 1,
    images: {
      [source]: {
        src: source,
        originalSrc: original,
        width: 960,
        height: 480,
        originalWidth: 2400,
        originalHeight: 1200,
        variants: [
          { src: "https://cdn.example.com/hash/w960.webp", width: 960 },
          { src: "https://cdn.example.com/hash/w640.webp", width: 640 },
          { src: "https://cdn.example.com/hash/w960-duplicate.webp", width: 960 },
        ],
      },
    },
  };
  const html = await render(`![화면 &#123;width=360&#125;](${source})`, {}, {
    rehypePlugins: [
      ...mdxOptions.rehypePlugins.slice(0, -1),
      [rehypePostImages, { mode: "local", manifest }],
    ],
  });

  assert.match(html, /src="https:\/\/cdn\.example\.com\/hash\/w960\.webp"/);
  assert.match(html, /srcSet="https:\/\/cdn\.example\.com\/hash\/w640\.webp 640w, https:\/\/cdn\.example\.com\/hash\/w960\.webp 960w"/);
  assert.match(html, /sizes="\(max-width: 360px\) 100vw, 360px"/);
  assert.match(html, /width="960" height="480"/);
  assert.match(html, /loading="lazy" decoding="async"/);
  assert.match(html, /data-original-src="https:\/\/cdn\.example\.com\/hash\/original\.png"/);
  assert.match(html, /data-original-width="2400" data-original-height="1200"/);
  assert.doesNotMatch(html, /rel="preload"/);
});

test("관리 모드에서는 manifest에 없는 본문 이미지를 빌드 오류로 처리하고 off에서는 허용한다", async () => {
  const manifest = { version: 1, images: {} };
  await assert.rejects(
    render("![누락](/missing.png)", {}, {
      rehypePlugins: [[rehypePostImages, { mode: "s3", manifest }]],
    }),
    /manifest에 본문 이미지가 없습니다/,
  );
  const html = await render("![기존](/legacy.png)", {}, {
    rehypePlugins: [[rehypePostImages, { mode: "off", manifest }]],
  });
  assert.match(html, /src="\/legacy\.png"/);
});
