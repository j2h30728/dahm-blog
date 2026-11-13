import { publishBlog } from './lib/publish-blog.mjs';
import { root, contentOptions } from './content-environment.mjs';
import { getSiteUrl } from '../apps/blog/src/lib/site.ts';

const args = process.argv.slice(2);
if (args.some(arg => !['--dry-run', '--help', '-h'].includes(arg))) {
  console.error('사용법: pnpm publish:blog [--dry-run | --help]');
  process.exitCode = 1;
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`사용법: pnpm publish:blog [--dry-run]

공개 글·메모 동기화 → Astro 빌드 검증 → 콘텐츠 변경만 커밋 → push.
기본 대상: origin/main (BLOG_PUBLISH_REMOTE, BLOG_PUBLISH_BRANCH로 변경).
--dry-run: 로컬 준비상태만 확인. 동기화·빌드·fetch·staging·커밋·push 없음.
기존 staging이나 콘텐츠 외 미커밋 변경이 있으면 중단합니다.
최초 Astro 전환 코드는 먼저 별도로 커밋·push해야 합니다.`);
} else {
  try {
    const { sourceDir } = contentOptions();
    try { getSiteUrl({ ...process.env, NODE_ENV: 'production' }); }
    catch { throw new Error('PUBLIC_SITE_URL을 설정하세요. 로컬 빌드 검증에서만 ALLOW_LOCAL_SITE_URL=true를 사용할 수 있습니다.'); }
    await publishBlog({ repoDir: root, sourceDir, remote: process.env.BLOG_PUBLISH_REMOTE?.trim() || 'origin', branch: process.env.BLOG_PUBLISH_BRANCH?.trim() || 'main', dryRun: args.includes('--dry-run') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
