import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(appRoot, "../..");

test("uses the Next blog as the default public app", () => {
  const rootPackage = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));
  const appPackage = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));
  const vercelConfig = JSON.parse(readFileSync(path.join(workspaceRoot, "vercel.json"), "utf8"));

  assert.equal(rootPackage.scripts.dev, "pnpm sync:content && pnpm --filter @dahm-blog/blog dev");
  assert.equal(rootPackage.scripts["sync:content"], "pnpm --filter @dahm-blog/content-sync sync -- --vault content");
  assert.equal(rootPackage.scripts["build:blog"], "pnpm sync:content && pnpm --filter @dahm-blog/blog build");
  assert.equal(rootPackage.scripts.build, "pnpm --filter @dahm-blog/content-sync build && pnpm sync:content && pnpm --filter @dahm-blog/private-wiki-index build && pnpm index:private && pnpm --filter @dahm-blog/blog build");
  assert.equal(rootPackage.scripts["sync:next-content"], undefined);
  assert.equal(rootPackage.scripts["build:next-blog"], undefined);
  assert.equal(rootPackage.scripts["test:next-blog"], undefined);
  assert.equal(rootPackage.scripts["typecheck:next-blog"], undefined);
  assert.equal(rootPackage.scripts["dev:next-blog"], undefined);
  assert.equal(appPackage.name, "@dahm-blog/blog");
  assert.equal(vercelConfig.framework, "nextjs");
  assert.equal(vercelConfig.buildCommand, "pnpm build:blog");
  assert.equal(vercelConfig.outputDirectory, "apps/blog/out");
});

test("declares the public blog routes in App Router", () => {
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

  assert.equal(existsSync(postIndexPath), true, "run sync:content before testing");
  assert.equal(existsSync(moduleMapPath), true, "run sync:content before testing");

  const postIndex = JSON.parse(readFileSync(postIndexPath, "utf8"));
  const moduleMap = readFileSync(moduleMapPath, "utf8");

  assert.equal(Array.isArray(postIndex.posts), true);
  assert.equal(postIndex.posts.length > 0, true);

  for (const post of postIndex.posts) {
    assert.equal(typeof post.slug, "string");
    assert.match(moduleMap, new RegExp(`"${post.slug}": \\(\\) => import\\("\\./posts/${post.slug}\\.mdx"\\)`));
  }
});
