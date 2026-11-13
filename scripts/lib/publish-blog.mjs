import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncContent, verifySnapshot } from '../../packages/content-sync/src/index.mjs';

const exec = promisify(execFile);
export const PUBLISH_PATHS = ['apps/blog/src/content', 'apps/blog/public/blog-assets'];
const managed = value => PUBLISH_PATHS.some(prefix => value.startsWith(prefix + '/'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = file => fs.access(file).then(() => true, () => false);

async function defaultBuild({ repoDir, env }) {
  const executable = env.npm_execpath;
  const nativePnpm = executable && /pnpm\.(?:c?js|mjs)$/.test(executable);
  const args = ['--filter', '@dahm-blog/blog', 'exec', 'astro', 'build'];
  await new Promise((resolve, reject) => {
    const child = spawn(nativePnpm ? process.execPath : 'pnpm', nativePnpm ? [executable, ...args] : args, { cwd: repoDir, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Astro 빌드 실패 (${code ?? 'signal'}). 커밋·push하지 않았습니다.`)));
  });
}

/** Publish only the managed public snapshot. No Git or source mutation occurs on import. */
export async function publishBlog({ repoDir, sourceDir, remote = 'origin', branch = 'main', dryRun = false, sync = syncContent, verify = verifySnapshot, build = defaultBuild, log = console.log, env = process.env }) {
  repoDir = path.resolve(repoDir);
  if (!sourceDir) throw new Error('OBSIDIAN_BLOG_DIR에 원본 blog 폴더를 설정하세요.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote) || !branch || branch.startsWith('-')) throw new Error('발행 remote 또는 branch 이름이 올바르지 않습니다.');
  const gitEnv = { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  // Do not accidentally operate on an ambient alternate repository/index.
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) {
    if (gitEnv[key]) throw new Error(`${key}가 설정된 환경에서는 발행하지 않습니다.`);
  }
  async function git(args, allowed = [0]) {
    try {
      const result = await exec('git', args, { cwd: repoDir, env: gitEnv, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
      return { code: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      if (allowed.includes(error.code)) return { code: error.code, stdout: error.stdout ?? Buffer.alloc(0), stderr: error.stderr ?? Buffer.alloc(0) };
      const detail = String(error.stderr || error.message).trim().replace(/(https?:\/\/)[^\s/@]+@/g, '$1[인증정보]@');
      throw new Error(`git ${args[0]} 실패: ${detail}`, { cause: error });
    }
  }
  const text = async args => (await git(args)).stdout.toString('utf8').trim();
  const gitPath = async name => path.resolve(repoDir, await text(['rev-parse', '--git-path', name]));
  await git(['check-ref-format', `refs/heads/${branch}`]);
  const top = await fs.realpath(await text(['rev-parse', '--show-toplevel']));
  if (top !== await fs.realpath(repoDir)) throw new Error('저장소 최상위 폴더에서 발행해야 합니다.');
  const tracking = `refs/remotes/${remote}/${branch}`;

  async function assertNoStaging() {
    if ((await git(['diff', '--cached', '--quiet', '--exit-code'], [0, 1])).code !== 0) {
      throw new Error('이미 스테이징된 변경이 있습니다. 기존 staging을 먼저 정리한 뒤 다시 실행하세요.');
    }
  }
  async function assertOnlyContentDirty() {
    const records = (await git(['status', '--porcelain=v1', '-z', '--untracked-files=all'])).stdout.toString('utf8').split('\0');
    const outside = [];
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (!record) continue;
      const state = record.slice(0, 2);
      const files = [record.slice(3)];
      if (/[RC]/.test(state)) files.push(records[++index]);
      for (const file of files) if (!file || !managed(file)) outside.push(file || '(알 수 없는 경로)');
    }
    if (outside.length) throw new Error(`콘텐츠 외 미커밋 변경이 있습니다. 사이트 코드 변경을 먼저 별도로 커밋·push하세요: ${outside.slice(0, 5).join(', ')}`);
  }
  async function preflight() {
    const current = await text(['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '');
    if (current !== branch) throw new Error(`발행 브랜치는 ${branch}입니다. 현재 브랜치가 다르거나 detached HEAD 상태입니다.`);
    for (const state of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
      if (await exists(await gitPath(state))) throw new Error('merge·rebase·cherry-pick 등 진행 중인 Git 작업을 먼저 마무리하세요.');
    }
    const flags = (await git(['ls-files', '-v', '-z'])).stdout.toString('utf8').split('\0').filter(Boolean);
    if (flags.some(record => record[0] === 'S' || /[a-z]/.test(record[0]))) throw new Error('assume-unchanged 또는 skip-worktree 파일이 있어 변경을 안전하게 확인할 수 없습니다.');
    await assertNoStaging();
    await assertOnlyContentDirty();
    const upstream = (await git(['for-each-ref', '--format=%(upstream:remotename)%00%(upstream:remoteref)', `refs/heads/${branch}`])).stdout.toString('utf8').trim().split('\0');
    if (upstream[0] !== remote || upstream[1] !== `refs/heads/${branch}`) throw new Error(`upstream을 ${remote}/${branch}로 먼저 설정하세요. 발행 명령이 임의로 remote·branch를 만들지 않습니다.`);
  }
  async function pendingCommits() {
    const [behind, ahead] = (await text(['rev-list', '--left-right', '--count', `${tracking}...HEAD`])).split(/\s+/).map(Number);
    if (behind) throw new Error('원격 브랜치가 앞서 있거나 이력이 갈라졌습니다. 먼저 pull/rebase를 직접 정리하세요.');
    if (ahead) {
      for (const commit of (await text(['rev-list', `${tracking}..HEAD`])).split('\n').filter(Boolean)) {
        const parents = (await text(['rev-list', '--parents', '-n', '1', commit])).split(/\s+/);
        const paths = (await git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', commit])).stdout.toString('utf8').split('\0').filter(Boolean);
        if (parents.length !== 2 || !paths.length || paths.some(file => !managed(file))) throw new Error('미push 커밋에 사이트 코드 또는 merge 커밋이 있습니다. 초기 전환/코드 변경은 먼저 별도로 push하세요.');
      }
    }
    return ahead;
  }
  await preflight();
  if (dryRun) {
    const ahead = await pendingCommits();
    log(`[dry-run] ${remote}/${branch}: 공개 콘텐츠 동기화 → Astro 빌드 → 콘텐츠 커밋·push 예정`);
    log('[dry-run] 원격 상태 갱신·원본 동기화·빌드·staging·commit·push는 실행하지 않았습니다. 변경 여부는 실제 실행에서 확인합니다.');
    return { status: 'dry-run', pushed: false, pendingCommits: ahead };
  }

  const lockPath = await gitPath('blog-publish.lock');
  const lock = await fs.open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw new Error('다른 블로그 발행이 진행 중이거나 이전 lock이 남아 있습니다. 실행 상태를 먼저 확인하세요.');
    throw error;
  });
  let messageDir;
  try {
    await preflight();
    await git(['fetch', '--no-tags', '--no-recurse-submodules', remote, `refs/heads/${branch}:${tracking}`]);
    let ahead = await pendingCommits();
    const initialHead = await text(['rev-parse', 'HEAD']);
    const options = { sourceDir, contentDir: path.join(repoDir, PUBLISH_PATHS[0]), assetsDir: path.join(repoDir, PUBLISH_PATHS[1]) };
    log('Obsidian 공개 글·메모와 참조 첨부를 가져옵니다.');
    await sync(options);
    const snapshot = await verify(options);
    const fingerprint = JSON.stringify(snapshot);
    const manifestBytes = await fs.readFile(path.join(options.contentDir, 'export-manifest.json'));
    log('Astro 정적 빌드를 검증합니다.');
    await build({ repoDir, env: gitEnv, log });
    if (JSON.stringify(await verify(options)) !== fingerprint) throw new Error('빌드 중 공개 콘텐츠가 변경되었습니다. 다시 발행하세요. 커밋·push하지 않았습니다.');
    if (await text(['rev-parse', 'HEAD']) !== initialHead) throw new Error('발행 중 HEAD가 변경되었습니다. 커밋·push하지 않았습니다.');
    await preflight();

    await git(['add', '-A', '--', ...PUBLISH_PATHS]);
    const changed = (await git(['diff', '--cached', '--quiet', '--exit-code'], [0, 1])).code !== 0;
    if (changed) {
      const staged = (await git(['diff', '--cached', '--name-only', '-z'])).stdout.toString('utf8').split('\0').filter(Boolean);
      if (staged.some(file => !managed(file))) throw new Error('발행 중 다른 파일이 staging에 추가됐습니다. 커밋하지 않았습니다. staging을 확인하세요.');
      const expected = new Map([
        [`${PUBLISH_PATHS[0]}/export-manifest.json`, { bytes: manifestBytes }],
        ...snapshot.entries.map(entry => [`${PUBLISH_PATHS[0]}/${entry.file}`, { sha256: entry.sha256 }]),
        ...snapshot.assets.map(asset => [`${PUBLISH_PATHS[1]}/${asset.file}`, { sha256: asset.sha256 }]),
      ]);
      const indexed = new Map();
      const algorithm = await text(['rev-parse', '--show-object-format']);
      for (const record of (await git(['ls-files', '--stage', '-z', '--', ...PUBLISH_PATHS])).stdout.toString('utf8').split('\0').filter(Boolean)) {
        const match = /^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]*)$/.exec(record);
        if (!match || match[1] !== '100644' || match[3] !== '0') throw new Error('발행 index의 파일 모드 또는 충돌 상태를 확인하세요.');
        indexed.set(match[4], match[2]);
      }
      if (indexed.size !== expected.size || [...expected.keys()].some(file => !indexed.has(file))) throw new Error('staging된 콘텐츠 목록이 검증한 snapshot과 다릅니다. 커밋하지 않았습니다.');
      for (const [file, metadata] of expected) {
        const bytes = await fs.readFile(path.join(repoDir, file));
        if (metadata.bytes ? !bytes.equals(metadata.bytes) : digest(bytes) !== metadata.sha256) throw new Error('staging 중 공개 콘텐츠가 변경되었습니다. 커밋하지 않았습니다. staging을 확인하세요.');
        const object = createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        if (object !== indexed.get(file)) throw new Error('index 내용이 검증된 콘텐츠와 다릅니다. 커밋하지 않았습니다.');
      }
      const tree = await text(['write-tree']);
      if (await text(['rev-parse', 'HEAD']) !== initialHead) throw new Error('커밋 직전 HEAD가 변경되었습니다. staging을 확인하세요.');
      const message = '[docs](blog): 공개 글·메모 변경 반영\n\n공개 대상으로 지정한 문서와 참조 첨부를 동기화합니다.\n\nConstraint: 사이트 코드는 발행 커밋에서 제외\nScope-risk: narrow\n';
      messageDir = await fs.mkdtemp(path.join(path.dirname(lockPath), 'blog-publish-message-'));
      const messageFile = path.join(messageDir, 'message.txt');
      await fs.writeFile(messageFile, message);
      try { await git(['commit', '--file', messageFile]); }
      catch (error) { throw new Error(`커밋에 실패해 push하지 않았습니다. staging은 유지했습니다. 원인을 해결한 뒤 git restore --staged -- ${PUBLISH_PATHS.join(' ')}로 staging을 해제하고 재실행하세요. ${error.message}`, { cause: error }); }
      if (await text(['rev-parse', 'HEAD^{tree}']) !== tree) throw new Error('hook 등이 검증한 커밋 내용을 변경했습니다. push하지 않았습니다. 커밋을 직접 확인하세요.');
      ahead++;
    }
    if (!ahead) {
      log('공개 콘텐츠 변경과 미push 콘텐츠 커밋이 없어 발행을 생략합니다.');
      return { status: 'unchanged', pushed: false };
    }
    // Also validate any commits added by a hook/concurrent Git process before publishing them.
    await pendingCommits();
    const commit = await text(['rev-parse', 'HEAD']);
    log(`${remote}/${branch}에 콘텐츠 커밋을 push합니다.`);
    try { await git(['push', '--porcelain', '--no-follow-tags', remote, `HEAD:refs/heads/${branch}`]); }
    catch (error) { throw new Error(`push에 실패했습니다. 로컬 콘텐츠 커밋 ${commit.slice(0, 12)}은 유지했습니다. 연결·권한 문제를 해결한 후 같은 명령으로 재시도하세요. ${error.message}`, { cause: error }); }
    log(`push 완료: ${commit.slice(0, 12)}. 연결된 Vercel Git 배포가 진행됩니다.`);
    return { status: 'published', pushed: true, commit, entries: snapshot.entries.length };
  } finally {
    if (messageDir) await fs.rm(messageDir, { recursive: true, force: true });
    await lock.close();
    await fs.unlink(lockPath);
  }
}
