import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { syncContent } from '../packages/content-sync/src/index.mjs';
import { prepareContent } from './prepare-content.mjs';
import { root } from './content-environment.mjs';

const options = await prepareContent();
let timer;
let running = false;
let queued = false;
let closing = false;
let restarting = false;
let child;

function startServer() {
  if (closing) return;
  const packageManager = process.env.npm_execpath;
  const nativePnpm = packageManager && /pnpm\.(?:c?js|mjs)$/.test(packageManager);
  const current = spawn(nativePnpm ? process.execPath : 'pnpm', nativePnpm ? [packageManager, '--filter', '@dahm-blog/blog', 'dev'] : ['--filter', '@dahm-blog/blog', 'dev'], { cwd: root, stdio: 'inherit', detached: true });
  child = current;
  current.once('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
  current.once('exit', code => {
    if (child === current) child = undefined;
    if (!closing && !restarting) { stop(); process.exitCode = code ?? 1; }
  });
}

async function stopServer() {
  const current = child;
  if (!current || current.exitCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      try { process.kill(-current.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
    }, 3000);
    current.once('exit', () => { clearTimeout(timeout); resolve(); });
    try { process.kill(-current.pid, 'SIGTERM'); } catch { clearTimeout(timeout); resolve(); }
  });
}

async function restartServer() {
  restarting = true;
  try { await stopServer(); } finally { restarting = false; }
  startServer();
}

async function update() {
  if (closing) return;
  if (running) { queued = true; return; }
  running = true;
  try {
    do {
      queued = false;
      try {
        await syncContent(options);
        // A fresh Astro process avoids stale collection/module caches after atomic snapshot replacement.
        await restartServer();
        console.log('[Obsidian] 공개 콘텐츠 갱신 완료');
      } catch (error) {
        console.error('[Obsidian] 동기화 실패. 원본을 수정하면 다시 시도합니다:', error.message);
      }
    } while (queued && !closing);
  } finally { running = false; }
}

const watcher = options.sourceDir ? watch(options.sourceDir, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(update, 350);
}) : undefined;
watcher?.on('error', (error) => console.error('[Obsidian] 폴더 감시 오류:', error.message));
if (watcher) console.log('[Obsidian] posts·notes·assets 변경을 감시합니다.');

function stop() {
  closing = true;
  clearTimeout(timer);
  watcher?.close();
  return stopServer();
}
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
startServer();
