import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function dataModule(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function compileModule(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const code = outputText.replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(imports[name] ?? name)}`);
  return dataModule(code);
}

const linkIndex = {
  nodes: [
    node("current", "현재 글"),
    node("alpha", "Alpha"),
    node("한글-글", "한글 글"),
    node("unreferenced", "참조하지 않은 글"),
  ],
  edges: [
    edge("current", "alpha"),
    edge("current", "alpha"),
    edge("current", "한글-글"),
    edge("current", "missing"),
    edge("other", "unreferenced"),
  ],
};
const linkIndexStub = dataModule(`export default ${JSON.stringify(linkIndex)}`);
const { getLinkPreviewPayload } = await import(compileModule("../src/lib/public-link-index.ts", {
  "../content/public-link-index.json": linkIndexStub,
}));

test("링크 미리보기는 현재 글이 참조한 존재하는 대상만 중복 없이 전달한다", () => {
  const previews = getLinkPreviewPayload("current");

  assert.deepEqual(Object.keys(previews), ["alpha", "한글-글"]);
  assert.equal(previews.alpha.title, "Alpha");
  assert.equal(previews["한글-글"].href, "/posts/%ED%95%9C%EA%B8%80-%EA%B8%80/");
  assert.equal("missing" in previews, false);
  assert.equal("unreferenced" in previews, false);
});

test("참조 링크가 없는 글은 빈 미리보기 데이터만 전달한다", () => {
  assert.deepEqual(getLinkPreviewPayload("unreferenced"), {});
  assert.deepEqual(getLinkPreviewPayload("missing-source"), {});
});

const reactStub = dataModule(`export const useEffect = callback => { globalThis.__previewEffectRan = true; globalThis.__previewCleanup = callback(); }`);
const routeSegmentStub = compileModule("../src/lib/route-segment.ts");
const { PostEnhancements } = await import(compileModule("../src/components/PostEnhancements.tsx", {
  react: reactStub,
  "../lib/route-segment": routeSegmentStub,
}));

test("빈 미리보기에서는 미리보기 DOM을 만들지 않고 코드 복사와 목차 바인딩은 유지한다", () => {
  let cleanup;
  const originalDocument = globalThis.document;
  const selectors = [];
  let previewElements = 0;
  let appended = 0;
  globalThis.document = {
    createElement() {
      previewElements += 1;
      return { setAttribute() {}, remove() {}, hidden: true };
    },
    querySelectorAll(selector) {
      selectors.push(selector);
      return [];
    },
    body: { append() { appended += 1; } },
  };

  try {
    PostEnhancements({ previews: {} });
    cleanup = globalThis.__previewCleanup;
    assert.equal(globalThis.__previewEffectRan, true);
    assert.equal(previewElements, 0);
    assert.equal(appended, 0);
    assert.deepEqual(selectors, [".content pre", "[data-toc-link]"]);
  } finally {
    cleanup?.();
    globalThis.document = originalDocument;
    delete globalThis.__previewEffectRan;
    delete globalThis.__previewCleanup;
  }
});

test("퍼센트 인코딩된 한글 글 링크도 focus 시 해당 미리보기를 찾는다", () => {
  let cleanup;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const handlers = new Map();
  const attributes = new Map();
  const anchor = {
    classList: { add() {}, remove() {} },
    addEventListener(name, handler) { handlers.set(name, handler); },
    removeEventListener(name) { handlers.delete(name); },
    getAttribute(name) {
      if (name === "href") return "/posts/%ED%95%9C%EA%B8%80-%EA%B8%80/";
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    getBoundingClientRect() { return { left: 24, bottom: 40 }; },
  };
  const preview = {
    id: "",
    className: "",
    hidden: true,
    innerHTML: "",
    offsetHeight: 80,
    style: {},
    setAttribute() {},
    remove() {},
  };
  globalThis.document = {
    createElement() { return preview; },
    querySelectorAll(selector) {
      return selector === '.content a[href^="/posts/"]' ? [anchor] : [];
    },
    body: { append() {} },
  };
  globalThis.window = {
    location: { origin: "https://dahm.test" },
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener() {},
    removeEventListener() {},
  };

  try {
    PostEnhancements({
      previews: {
        "한글-글": {
          title: "한글 글",
          description: "한글 설명",
          excerpt: "",
          tags: ["한글"],
          href: "/posts/%ED%95%9C%EA%B8%80-%EA%B8%80/",
        },
      },
    });
    cleanup = globalThis.__previewCleanup;
    handlers.get("focus")?.();
    assert.equal(preview.hidden, false);
    assert.match(preview.innerHTML, /한글 글/);
    assert.equal(attributes.get("aria-describedby"), "internal-link-preview");
  } finally {
    cleanup?.();
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    delete globalThis.__previewEffectRan;
    delete globalThis.__previewCleanup;
  }
});

function node(slug, title) {
  return {
    slug,
    title,
    description: `${title} 설명`,
    excerpt: `${title} 요약`,
    topic: "frontend",
    tags: ["React"],
    href: `/posts/${encodeURIComponent(slug)}/`,
    headings: [],
  };
}

function edge(sourceSlug, targetSlug) {
  return { sourceSlug, targetSlug, kind: "none", label: targetSlug };
}
