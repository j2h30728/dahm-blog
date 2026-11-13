import { pathToFileURL } from 'node:url';
import { syncContent, verifySnapshot } from '../packages/content-sync/src/index.mjs';
import { contentOptions } from './content-environment.mjs';

export async function prepareContent() {
  const options = contentOptions();
  if (options.sourceDir) {
    // An explicitly configured but inaccessible source must fail; never silently use stale data.
    await syncContent(options);
    console.log('Obsidian 공개 콘텐츠 동기화 완료');
  } else {
    await verifySnapshot(options);
    console.log('저장소의 공개 콘텐츠 snapshot 검증 완료');
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareContent();
}
