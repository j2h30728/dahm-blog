import { syncContent } from '../packages/content-sync/src/index.mjs';
import { contentOptions } from './content-environment.mjs';

const options = contentOptions();
if (!options.sourceDir) {
  throw new Error('OBSIDIAN_BLOG_DIR을 .env.local에 설정하세요. Obsidian의 blog 폴더를 지정합니다.');
}
await syncContent(options);
console.log('Obsidian 공개 글·메모와 참조 첨부 동기화 완료');
