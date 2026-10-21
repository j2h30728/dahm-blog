import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { mdxOptions } from "../next.config.mjs";

const require = createRequire(import.meta.url);
const loaderRequire = createRequire(require.resolve("@mdx-js/loader"));
const { evaluate } = await import(pathToFileURL(loaderRequire.resolve("@mdx-js/mdx")).href);

async function render(markdown) {
  const { default: Content } = await evaluate(markdown, { ...mdxOptions, ...runtime });
  return renderToStaticMarkup(createElement(Content));
}

test("단일 개행은 줄바꿈으로, 빈 줄은 별도 문단으로 렌더링한다", async () => {
  for (const newline of ["\n", "\r\n"]) {
    const html = await render(["첫 줄", "둘째 줄", "", "다른 문단"].join(newline));
    assert.match(html, /<p>첫 줄<br\/>\s*둘째 줄<\/p>/);
    assert.match(html, /<p>다른 문단<\/p>/);
    assert.equal((html.match(/<p>/g) ?? []).length, 2);
  }
});

test("이미 명시한 hard break에 줄바꿈을 중복 추가하지 않는다", async () => {
  const html = await render("첫 줄\\\n둘째 줄");
  assert.equal((html.match(/<br\/>/g) ?? []).length, 1);
});

test("정상 강조·취소선·링크와 의도된 escaped 기호를 보존한다", async () => {
  const html = await render("**굵게** · *기울임* · ~~취소선~~\n\n\\*literal\\*와 `**code**`\n\n[링크](https://example.com/?q=1&next=two)");
  assert.match(html, /<strong>굵게<\/strong>/);
  assert.match(html, /<em>기울임<\/em>/);
  assert.match(html, /<del>취소선<\/del>/);
  assert.match(html, /\*literal\*/);
  assert.match(html, /<code>\*\*code\*\*<\/code>/);
  assert.match(html, /href="https:\/\/example.com\/\?q=1&amp;next=two"/);
});

test("괄호·따옴표로 끝난 강조가 한글·일본어·한자 문장에 붙어도 의미를 보존한다", async () => {
  for (const [source, expected] of [
    ["**서버(Node.js 프로세스)**에서는", "<strong>서버(Node.js 프로세스)</strong>에서는"],
    ["위한**'use client'**를", "위한<strong>&#x27;use client&#x27;</strong>를"],
    ["**模块(缓存)**的", "<strong>模块(缓存)</strong>的"],
    ["**モジュール(状態)**は", "<strong>モジュール(状態)</strong>は"],
  ]) {
    assert.equal(await render(source), `<p>${expected}</p>`);
  }
});

test("CJK 강조 보완은 escaped 기호·코드·링크 주소를 다시 해석하지 않는다", async () => {
  const html = await render("\\*\\*서버(예제)\\*\\*에서는 `**서버(코드)**에서는`\n\n[링크](https://example.com/**서버**/)");
  assert.match(html, /\*\*서버\(예제\)\*\*에서는/);
  assert.match(html, /<code>\*\*서버\(코드\)\*\*에서는<\/code>/);
  assert.doesNotMatch(html, /<strong>/);
  assert.match(html, /href="https:\/\/example.com\/\*\*/);
});

test("제목과 표 셀의 CJK 강조도 구조나 링크 주소를 바꾸지 않고 렌더링한다", async () => {
  const html = await render("## **서버(설계)**에서는\n\n| 항목 | 설명 |\n| --- | --- |\n| **캐시(상태)**에는 | [링크](https://example.com/a**b**/) |");
  assert.match(html, /<h2[^>]*><strong>서버\(설계\)<\/strong>에서는<\/h2>/);
  assert.match(html, /<td><strong>캐시\(상태\)<\/strong>에는<\/td>/);
  assert.match(html, /href="https:\/\/example.com\/a\*\*b\*\*\/"/);
});

test("중첩 목록·시작 번호·인용·GFM 표의 구조를 보존한다", async () => {
  const html = await render("- 첫 항목\n  이어지는 줄\n  - 중첩 항목\n\n7. 일곱\n8. 여덟\n\n> 인용 첫 줄\n> 인용 둘째 줄\n\n| 이름 | 코드 |\n| --- | --- |\n| 값 | `a \\| b` |\n");
  assert.equal((html.match(/<ul>/g) ?? []).length, 2);
  assert.match(html, /<li>첫 항목<br\/>\s*이어지는 줄/);
  assert.match(html, /<ol start="7">/);
  assert.match(html, /<blockquote>\s*<p>인용 첫 줄<br\/>\s*인용 둘째 줄<\/p>/);
  assert.match(html, /<table>/);
  assert.match(html, /<code>a \| b<\/code>/);
});

test("코드 블록 원문·빈 줄·리터럴 기호를 보존하고 밝고 어두운 토큰을 함께 생성한다", async () => {
  const code = 'const label = "*literal*";\n\n// # 제목과 **강조**도 코드 그대로';
  const html = await render(`\`\`\`javascript\n${code}\n\`\`\``);
  const codeHtml = html.match(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/)?.[1];
  assert.ok(codeHtml);
  const text = codeHtml.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  assert.equal(text.trimEnd(), code);
  assert.doesNotMatch(codeHtml, /<br/);
  assert.match(html, /--shiki-dark/);
  assert.match(html, /background-color:#fff(?:fff)?/i);
});

test("MDX JSX 안의 개행을 임의로 변환하지 않는다", async () => {
  const html = await render("<span>앞\n뒤</span>");
  assert.match(html, /<span>앞\n뒤<\/span>/);
  assert.doesNotMatch(html, /<br/);
});

test("본문 회귀 fixture의 모든 heading·문단·목록·표·코드를 실제 MDX 설정으로 컴파일한다", async () => {
  const source = readFileSync(new URL("./fixtures/body.mdx", import.meta.url), "utf8");
  const html = await render(source);
  for (let depth = 1; depth <= 6; depth++) assert.match(html, new RegExp(`<h${depth}[^>]*>`));
  for (const tag of ["strong", "em", "del", "blockquote", "ul", "ol", "table", "pre", "hr"]) {
    assert.match(html, new RegExp(`<${tag}(?:[ >]|/)`));
  }
});
