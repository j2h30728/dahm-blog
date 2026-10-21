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

const require = createRequire(import.meta.url);
const loaderRequire = createRequire(require.resolve("@mdx-js/loader"));
const { evaluate } = await import(pathToFileURL(loaderRequire.resolve("@mdx-js/mdx")).href);

function compileModule(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const code = outputText.replace(/from "([^"]+)"/g, (_, name) =>
    `from ${JSON.stringify(imports[name] ?? pathToFileURL(require.resolve(name)).href)}`);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

const imageModule = compileModule("../src/components/ZoomableImage.tsx");
const { useMDXComponents } = await import(compileModule("../src/mdx-components.tsx", {
  "./components/ZoomableImage": imageModule,
}));

async function render(markdown, overrides = {}) {
  const { default: Content } = await evaluate(markdown, { ...mdxOptions, ...runtime });
  return renderToStaticMarkup(createElement(Content, { components: useMDXComponents(overrides) }));
}

test("문단의 모든 Markdown 이미지를 SSR 가능한 확대 버튼으로 렌더링한다", async () => {
  const html = await render("앞 문장\n![설계 그림](/diagram.png)\n뒤 문장\n\n![](https://example.com/photo.jpg)");
  assert.equal((html.match(/class="post-image-trigger"/g) ?? []).length, 2);
  assert.match(html, /<p>앞 문장<br\/>\s*<button[^>]*aria-haspopup="dialog"[^>]*><img[^>]*alt="설계 그림"/);
  assert.match(html, /src="\/diagram.png"/);
  assert.match(html, /aria-label="본문 이미지 확대"/);
  assert.doesNotMatch(html, /<(?:dialog|figure|div)\b/);
});

test("이미지 링크는 중첩 버튼 없이 확대 링크로 렌더링하고 일반 링크는 보존한다", async () => {
  const html = await render("[![링크 사진](/photo.png)](/original.png)\n\n[일반 링크](/about/)");
  assert.match(html, /<a[^>]*href="\/original.png"[^>]*aria-haspopup="dialog"[^>]*><img/);
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
