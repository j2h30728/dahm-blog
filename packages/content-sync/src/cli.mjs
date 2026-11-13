import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncContent, verifySnapshot } from './index.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
// Explicit environment variables win; .env.local then .env fill only missing values.
for (const name of ['.env.local', '.env']) {
  try { process.loadEnvFile(path.join(root, name)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const options = { contentDir: path.join(root, 'apps/blog/src/content'), assetsDir: path.join(root, 'apps/blog/public/blog-assets'), sourceDir: process.env.OBSIDIAN_BLOG_DIR };
const args = process.argv.slice(2);
let verify = false;
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (flag === '--verify' || flag === '--snapshot') { verify = true; continue; }
  const keys = { '--source': 'sourceDir', '--content-dir': 'contentDir', '--assets-dir': 'assetsDir' };
  if (!keys[flag] || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`지원하지 않거나 값이 없는 옵션입니다: ${flag}`);
  options[keys[flag]] = path.resolve(args[++index]);
}
try {
  const manifest = await (verify ? verifySnapshot(options) : syncContent(options));
  console.log(`${verify ? '공개 snapshot 확인' : 'Obsidian 공개 콘텐츠 내보내기'}: 글 ${manifest.entries.filter((entry) => entry.kind === 'posts').length}개, 메모 ${manifest.entries.filter((entry) => entry.kind === 'notes').length}개, 첨부 ${manifest.assets.length}개`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
