import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { root } from './content-environment.mjs';
import { serveStatic } from './test-support.mjs';

const manifest = JSON.parse(await readFile(path.join(root, 'apps/blog/src/content/export-manifest.json'), 'utf8'));
const server = await serveStatic(path.join(root, 'apps/blog/dist'));
const artifacts = process.env.BROWSER_ARTIFACT_DIR || path.join(root, '.playwright-mcp/astro');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
// Tests focus on the site; comment/analytics network availability is not a prerequisite.
await context.route('https://giscus.app/**', route => route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-theme-toggle]');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.deepEqual(await page.locator('nav[aria-label="주 메뉴"] a:not([data-brand])').allTextContents().then(values => values.map(v => v.trim())), ['글', '메모', '소개']);
  await page.screenshot({ path: path.join(artifacts, 'home-desktop.png') });

  await page.locator('[data-theme-toggle]').click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page.locator('nav[aria-label="주 메뉴"] a[href="/notes/"]').click();
  await page.waitForURL('**/notes/');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin, 'Astro navigation should not reload the document');
  const noteCount = manifest.entries.filter(entry => entry.kind === 'notes').length;
  assert.equal(await page.locator('main h1').innerText(), '메모');
  await page.locator('[data-tit-archive]').waitFor();
  if (!noteCount) assert.match(await page.locator('main').innerText(), /아직 공개된 메모가 없습니다/);
  await page.locator('[data-brand]').click();
  await page.waitForURL(server.url + '/');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');

  const entry = manifest.entries.find(item => item.kind === 'posts');
  if (entry) {
    await page.locator('[data-search-toggle]').click();
    const search = page.locator('#site-search');
    await search.fill(entry.title);
    await search.press('Enter');
    await page.waitForTimeout(350);
    assert.match(await page.locator('main').innerText(), new RegExp(entry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await page.goto(server.url + entry.href, { waitUntil: 'networkidle' });
    assert.match(await page.locator('h1').innerText(), new RegExp(entry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  // Choose a real exported article containing a code example, not a fixed historical slug.
  let codeEntry;
  let imageEntry;
  for (const item of manifest.entries) {
    const markdown = await readFile(path.join(root, 'apps/blog/src/content', item.file), 'utf8');
    if (!codeEntry && /^```/m.test(markdown)) codeEntry = item;
    if (!imageEntry && /obsidian-size=\d+/.test(markdown)) imageEntry = item;
  }
  if (codeEntry) {
    await page.goto(server.url + codeEntry.href, { waitUntil: 'networkidle' });
    const copy = page.locator('.code-copy-button').first();
    await copy.waitFor();
    const code = await page.locator('.content pre code').first().textContent();
    await copy.click();
    await page.waitForFunction(() => document.querySelector('.code-copy-button')?.getAttribute('data-state') === 'copied');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
  }
  if (imageEntry) {
    await page.goto(server.url + imageEntry.href, { waitUntil: 'networkidle' });
    const image = page.locator('.content img[width]').first();
    await image.waitFor();
    const dimensions = await image.evaluate(img => ({ width: img.width, target: Number(img.getAttribute('width')), viewport: innerWidth, complete: img.complete, naturalWidth: img.naturalWidth }));
    assert.ok(dimensions.complete && dimensions.naturalWidth > 0, 'Local image must load');
    assert.ok(dimensions.width <= dimensions.target + 1, 'Specified Obsidian image width must be respected');
    const trigger = page.locator('.post-image-trigger').first();
    await trigger.click();
    await page.locator('.post-image-dialog[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.post-image-dialog')?.hasAttribute('open'));
    assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
    await page.screenshot({ path: path.join(artifacts, 'article-desktop.png') });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(server.url, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile home must not overflow');
  await page.locator('nav[aria-label="주 메뉴"] a[href="/notes/"]').click();
  await page.waitForURL('**/notes/');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile notes must not overflow');
  if (imageEntry) {
    await page.goto(server.url + imageEntry.href, { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile article must not overflow');
    const image = page.locator('.content img[width]').first();
    assert.ok(await image.evaluate(img => img.getBoundingClientRect().width <= innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'article-mobile.png') });
  }
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.locator('[data-theme-toggle]').click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(artifacts, 'home-mobile.png') });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(JSON.stringify({ desktop: 'passed', mobile: 'passed', search: 'passed', themeAndNavigation: 'passed', codeCopy: Boolean(codeEntry), imageWidthAndDialog: Boolean(imageEntry), notes: noteCount, browserErrors: errors, screenshots: artifacts }));
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
