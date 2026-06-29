import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(appRoot, "../..");

test("keeps the Next blog as an opt-in sibling app", () => {
  const rootPackage = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));

  assert.equal(rootPackage.scripts.dev, "pnpm sync:content && pnpm --filter @dahm-blog/blog dev");
  assert.equal(rootPackage.scripts.build, "pnpm --filter @dahm-blog/content-sync build && pnpm sync:content && pnpm --filter @dahm-blog/private-wiki-index build && pnpm index:private && pnpm --filter @dahm-blog/blog build");
  assert.match(rootPackage.scripts["sync:next-content"], /--public-post-index apps\/next-blog\/src\/content\/public-post-index\.json/);
  assert.match(rootPackage.scripts["sync:next-content"], /--post-module-map apps\/next-blog\/src\/content\/post-module-map\.ts/);
  assert.match(rootPackage.scripts["sync:next-content"], /--jsx-attributes/);
  assert.equal(rootPackage.scripts["build:next-blog"], "pnpm sync:next-content && pnpm --filter @dahm-blog/next-blog build");
});

test("declares only current Astro parity routes in App Router", () => {
  const routeFiles = [
    "src/app/page.tsx",
    "src/app/about/page.tsx",
    "src/app/posts/page.tsx",
    "src/app/posts/[slug]/page.tsx",
    "src/app/series/page.tsx",
    "src/app/series/[series]/page.tsx",
    "src/app/rss.xml/route.ts",
  ];

  for (const routeFile of routeFiles) {
    assert.equal(existsSync(path.join(appRoot, routeFile)), true, `${routeFile} should exist`);
  }
});

test("uses generated content-sync artifacts for Next post routing", () => {
  const postIndexPath = path.join(appRoot, "src/content/public-post-index.json");
  const moduleMapPath = path.join(appRoot, "src/content/post-module-map.ts");

  assert.equal(existsSync(postIndexPath), true, "run sync:next-content before testing");
  assert.equal(existsSync(moduleMapPath), true, "run sync:next-content before testing");

  const postIndex = JSON.parse(readFileSync(postIndexPath, "utf8"));
  const moduleMap = readFileSync(moduleMapPath, "utf8");

  assert.equal(Array.isArray(postIndex.posts), true);
  assert.equal(postIndex.posts.length > 0, true);

  for (const post of postIndex.posts) {
    assert.equal(typeof post.slug, "string");
    assert.match(moduleMap, new RegExp(`"${post.slug}": \\(\\) => import\\("\\./posts/${post.slug}\\.mdx"\\)`));
  }
});
