import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';
import { syncContent, verifySnapshot } from '../packages/content-sync/src/index.mjs';
import { root } from './content-environment.mjs';
import { serveStatic } from './test-support.mjs';

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'dahm-astro-integration-'));
const app = path.join(work, 'apps/blog');
const sourceDir = path.join(work, 'vault/blog');
const options = { sourceDir, contentDir: path.join(app, 'src/content'), assetsDir: path.join(app, 'public/blog-assets') };
const originalApp = path.join(root, 'apps/blog');
const { parse: parseYaml, stringify: stringifyYaml } = createRequire(new URL('../packages/content-sync/package.json', import.meta.url))('yaml');
let browser;
let server;
let dev;
let devLog = '';

async function waitFor(check, message) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* Server/config may be restarting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(typeof message === 'function' ? message() : message);
}

async function startDev() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  // Run the real root dev command in an isolated workspace so fs.watch is tested too.
  await fs.mkdir(path.join(work, 'scripts'), { recursive: true });
  for (const name of ['dev.mjs', 'content-environment.mjs', 'prepare-content.mjs']) await fs.copyFile(path.join(root, 'scripts', name), path.join(work, 'scripts', name));
  const pipeline = path.join(work, 'packages/content-sync');
  await fs.mkdir(pipeline, { recursive: true });
  await fs.cp(path.join(root, 'packages/content-sync/src'), path.join(pipeline, 'src'), { recursive: true });
  await fs.copyFile(path.join(root, 'packages/content-sync/package.json'), path.join(pipeline, 'package.json'));
  await fs.symlink(path.join(root, 'packages/content-sync/node_modules'), path.join(pipeline, 'node_modules'), 'dir');
  const rootPackage = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(work, 'package.json'), JSON.stringify({ name: 'dahm-dev-fixture', private: true, type: 'module', packageManager: rootPackage.packageManager }));
  await fs.writeFile(path.join(work, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
  const appPackage = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
  appPackage.scripts.dev = `astro dev --host 127.0.0.1 --port ${port}`;
  await fs.writeFile(path.join(app, 'package.json'), JSON.stringify(appPackage));
  dev = spawn(process.execPath, [path.join(work, 'scripts/dev.mjs')], {
    cwd: work, detached: true, env: { ...process.env, OBSIDIAN_BLOG_DIR: sourceDir, PUBLIC_SITE_URL: 'https://example.test', GISCUS_ENABLED: 'false', VERCEL_ENV: 'preview' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  dev.stdout.on('data', data => { devLog += data; });
  dev.stderr.on('data', data => { devLog += data; });
  const url = `http://127.0.0.1:${port}`;
  await waitFor(async () => (await fetch(url + '/notes/', { signal: AbortSignal.timeout(1500) })).ok, () => `Fixture dev server did not start (exit ${dev.exitCode}): ${devLog}`);
  return url;
}

async function runPnpm(args) {
  await new Promise((resolve, reject) => {
    const executable = process.env.npm_execpath;
    const nativePnpm = executable && /pnpm\.(?:c?js|mjs)$/.test(executable);
    const child = spawn(nativePnpm ? process.execPath : 'pnpm', nativePnpm ? [executable, '--dir', app, ...args] : ['--dir', app, ...args], { env: { ...process.env, PUBLIC_SITE_URL: 'https://example.test', GISCUS_ENABLED: 'false', VERCEL_ENV: 'preview' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Fixture command ${args.join(' ')} failed (${code}):\n${output}`)));
  });
}
async function build() { await runPnpm(['build']); }
async function allText(directory) {
  let text = '';
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) text += await allText(file);
    else if (/\.(?:html|xml|json|txt|js)$/.test(entry.name)) text += await fs.readFile(file, 'utf8');
  }
  return text;
}

try {
  await fs.cp(originalApp, app, { recursive: true, filter: file => {
    const relative = path.relative(originalApp, file).split(path.sep).join('/');
    return !['node_modules', 'dist', '.astro', 'src/content', 'public/blog-assets', 'public/og/posts'].some(skip => relative === skip || relative.startsWith(skip + '/'));
  } });
  // A real isolated dependency tree avoids Astro virtual-module paths crossing a symlinked root.
  const packageJson = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
  packageJson.packageManager = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).packageManager;
  await fs.writeFile(path.join(app, 'package.json'), JSON.stringify(packageJson, null, 2));
  const lock = parseYaml(await fs.readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'));
  lock.importers = { '.': lock.importers['apps/blog'] };
  await fs.writeFile(path.join(app, 'pnpm-lock.yaml'), stringifyYaml(lock));
  await runPnpm(['install', '--offline', '--frozen-lockfile', '--ignore-scripts']);
  for (const directory of ['posts', 'notes', 'assets']) await fs.mkdir(path.join(sourceDir, directory), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'assets/public.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jdxkAAAAASUVORK5CYII=', 'base64'));
  await fs.writeFile(path.join(sourceDir, 'assets/note.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="green"/></svg>');
  await fs.writeFile(path.join(sourceDir, 'assets/private.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_ATTACHMENT_SENTINEL</text></svg>');
  const publicPost = `---\ntitle: Fixture published post\npublish: true\ndate: 2026-11-12\nslug: fixture-post\nsection: 기술\ntags: [fixture]\n---\n\n# Published article\n\nPUBLIC_POST_BODY_SENTINEL\n\n![[blog/assets/public.png|120]]\n\n[[notes/public-note|Open public note]]\n\n[[notes/private-note|Private reference label]]\n`;
  const publicNote = `---\ntitle: Fixture public note\npublish: true\ndate: 2026-11-12\nslug: fixture-note\ntags: [fixture]\n---\n\nPUBLIC_NOTE_BODY_SENTINEL\n\n![[blog/assets/note.svg|160x80]]\n`;
  const privateNote = `---\ntitle: PRIVATE_NOTE_TITLE_SENTINEL\npublish: false\nslug: private-note\n---\n\nPRIVATE_NOTE_BODY_SENTINEL\n\n![[blog/assets/private.svg]]\n`;
  await fs.writeFile(path.join(sourceDir, 'posts/public-post.md'), publicPost);
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote);
  await fs.writeFile(path.join(sourceDir, 'notes/private-note.md'), privateNote);
  const first = await syncContent(options);
  assert.equal(first.entries.length, 2);
  assert.equal(first.assets.length, 2);
  await verifySnapshot(options);
  await build();
  const output = await allText(path.join(app, 'dist'));
  for (const sentinel of ['PRIVATE_NOTE_TITLE_SENTINEL', 'PRIVATE_NOTE_BODY_SENTINEL', 'PRIVATE_ATTACHMENT_SENTINEL']) assert.ok(!output.includes(sentinel), `Private content leaked: ${sentinel}`);
  assert.ok(output.includes('PUBLIC_NOTE_BODY_SENTINEL'));
  const noteHtml = await fs.readFile(path.join(app, 'dist/notes/fixture-note/index.html'), 'utf8');
  assert.match(noteHtml, /width="160"/);
  assert.match(noteHtml, /height="80"/);
  assert.ok(!noteHtml.includes('obsidian-size='), 'Internal size marker must not be shown');
  assert.ok((await fs.readFile(path.join(app, 'dist/rss.xml'), 'utf8')).includes('/notes/fixture-note/'));
  assert.ok((await fs.readFile(path.join(app, 'dist/sitemap.xml'), 'utf8')).includes('/notes/fixture-note/'));

  server = await serveStatic(path.join(app, 'dist'));
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(server.url + '/notes/', { waitUntil: 'networkidle' });
  assert.ok((await page.locator('main').innerText()).includes('Fixture public note'));
  await page.locator('main a[href="/notes/fixture-note/"]').first().click();
  await page.waitForURL('**/notes/fixture-note/');
  assert.ok((await page.locator('.content').innerText()).includes('PUBLIC_NOTE_BODY_SENTINEL'));
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.locator('[data-search-toggle]').click();
  await page.locator('#site-search').fill('Fixture public note');
  await page.locator('#site-search').press('Enter');
  await page.waitForTimeout(350);
  assert.ok((await page.locator('main').innerText()).includes('Fixture public note'));
  await browser.close(); browser = undefined;
  await server.close(); server = undefined;

  // A previously public note must disappear from all generated surfaces after being unpublished.
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote.replace('publish: true', 'publish: false'));
  const second = await syncContent(options);
  assert.equal(second.entries.length, 1);
  assert.equal(second.assets.length, 1);
  await build();
  await assert.rejects(fs.stat(path.join(app, 'dist/notes/fixture-note/index.html')), /ENOENT/);
  const unpublished = await allText(path.join(app, 'dist'));
  assert.ok(!unpublished.includes('PUBLIC_NOTE_BODY_SENTINEL'));
  assert.ok(!unpublished.includes('Fixture public note'));
  assert.ok(!(await fs.readFile(path.join(app, 'dist/rss.xml'), 'utf8')).includes('/notes/fixture-note/'));
  assert.ok(!(await fs.readFile(path.join(app, 'dist/sitemap.xml'), 'utf8')).includes('/notes/fixture-note/'));
  // The running Astro server must discover a formerly empty notes collection without manual restart.
  const devUrl = await startDev();
  assert.ok(!(await (await fetch(devUrl + '/notes/')).text()).includes('href="/notes/fixture-note/"'));
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote);
  await waitFor(async () => (await (await fetch(devUrl + '/notes/')).text()).includes('href="/notes/fixture-note/"'), () => `Astro dev did not discover newly published note:\n${devLog}`);
  await waitFor(async () => (await (await fetch(devUrl + '/notes/fixture-note/')).text()).includes('PUBLIC_NOTE_BODY_SENTINEL'), 'Astro dev note detail did not update');
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote.replace('publish: true', 'publish: false'));
  await waitFor(async () => !(await (await fetch(devUrl + '/notes/')).text()).includes('Fixture public note'), 'Astro dev did not remove unpublished note');
  console.log(JSON.stringify({ publicNote: 'listing/detail/search/RSS/sitemap passed', noteDimensions: '160x80 passed', privateContent: 'excluded', unpublish: 'route/search/RSS/sitemap/assets pruned', devCollectionUpdates: 'empty → published → private passed', source: 'isolated fixture; real vault untouched' }));
} finally {
  if (dev?.pid) {
    try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    await new Promise(resolve => dev.exitCode !== null ? resolve() : dev.once('exit', resolve));
  }
  if (browser) await browser.close();
  if (server) await server.close();
  await fs.rm(work, { recursive: true, force: true });
}
