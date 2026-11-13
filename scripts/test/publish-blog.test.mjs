import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { publishBlog } from '../lib/publish-blog.mjs';
import { syncContent, verifySnapshot } from '../../packages/content-sync/src/index.mjs';

const execute = promisify(execFile);
const managed = ['apps/blog/src/content', 'apps/blog/public/blog-assets'];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Review-runner scoped Git overrides must never affect the temporary repositories.
function fixtureEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/.test(key) || /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key)) delete env[key];
  }
  return { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
}

async function createFixture(t, { branch = 'main', remote = 'origin' } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dahm-publish-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const repoDir = path.join(directory, 'repo');
  const bareDir = path.join(directory, 'remote.git');
  const sourceDir = path.join(directory, 'vault/blog');
  const env = fixtureEnvironment();
  const git = async (...args) => {
    const result = await execute('git', args, { cwd: repoDir, env, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    return result.stdout.trim();
  };
  await fs.mkdir(repoDir, { recursive: true });
  await execute('git', ['init', '--bare', '--initial-branch', branch, bareDir], { env });
  await git('init', '--initial-branch', branch);
  await git('config', 'user.name', 'Publish Test');
  await git('config', 'user.email', 'publish-test@example.invalid');
  await git('config', 'commit.gpgsign', 'false');
  await git('config', 'core.autocrlf', 'false');
  await git('config', 'core.hooksPath', path.join(repoDir, '.git/hooks'));
  for (const folder of ['posts', 'notes', 'assets']) await fs.mkdir(path.join(sourceDir, folder), { recursive: true });
  const options = {
    sourceDir,
    contentDir: path.join(repoDir, managed[0]),
    assetsDir: path.join(repoDir, managed[1]),
  };
  await syncContent(options);
  await fs.writeFile(path.join(repoDir, 'README.md'), 'temporary test repository\n');
  // Git mutations in this file are intentionally restricted to mkdtemp repositories.
  await git('add', '--', '.');
  await git('commit', '-m', 'test baseline');
  await git('remote', 'add', remote, bareDir);
  await git('push', '--set-upstream', remote, branch);
  let buildCalls = 0;
  const logs = [];
  const run = (extra = {}) => publishBlog({
    repoDir, sourceDir, remote, branch,
    env,
    build: async () => { buildCalls++; },
    log: (message) => logs.push(message),
    ...extra,
  });
  const write = async (file, content) => {
    const destination = path.join(sourceDir, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
  };
  const document = ({ slug = 'hello', title = '테스트 글', publish = true, body = '본문', date = '2026-11-13' } = {}) =>
    `---\ntitle: ${JSON.stringify(title)}\npublish: ${JSON.stringify(publish)}\ndate: ${date}\nslug: ${slug}\ntags: []\n---\n\n${body}\n`;
  const head = () => git('rev-parse', 'HEAD');
  const remoteHead = async () => (await execute('git', ['--git-dir', bareDir, 'rev-parse', `refs/heads/${branch}`], { env })).stdout.trim();
  const state = async () => ({
    head: await head(),
    remote: await remoteHead(),
    index: digest(await fs.readFile(path.join(repoDir, '.git/index'))),
    status: await git('status', '--porcelain=v1', '-z'),
  });
  const hook = async (name, body, remoteHook = false) => {
    const filename = path.join(remoteHook ? bareDir : path.join(repoDir, '.git'), 'hooks', name);
    await fs.writeFile(filename, '#!/bin/sh\n' + body + '\n', { mode: 0o755 });
    await fs.chmod(filename, 0o755);
    return filename;
  };
  const peerCommit = async () => {
    const peer = path.join(directory, 'peer-' + Math.random().toString(16).slice(2));
    await execute('git', ['clone', '--branch', branch, bareDir, peer], { env });
    const peerGit = (args) => execute('git', args, { cwd: peer, env });
    await peerGit(['config', 'user.name', 'Remote Writer']);
    await peerGit(['config', 'user.email', 'remote-writer@example.invalid']);
    await peerGit(['config', 'commit.gpgsign', 'false']);
    await fs.writeFile(path.join(peer, 'README.md'), 'remote update\n');
    await peerGit(['add', '--', 'README.md']);
    await peerGit(['commit', '-m', 'remote update']);
    await peerGit(['push', 'origin', branch]);
  };
  const stageManaged = () => git('add', '-A', '--', ...managed);
  return { directory, repoDir, bareDir, sourceDir, env, branch, remote, options, git, run, write, document, head, remoteHead, state, hook, peerCommit, stageManaged, logs, buildCalls: () => buildCalls };
}

async function captureFiles(root) {
  const records = {};
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile()) records[path.relative(root, filename)] = digest(await fs.readFile(filename));
    }
  }
  await walk(root);
  return records;
}

test('공개 글·메모·참조 첨부만 한 커밋으로 push하고 공개 취소 삭제도 반영한다', async (t) => {
  const f = await createFixture(t);
  const baseline = await f.head();
  await f.write('assets/photo.png', 'public image');
  await f.write('assets/secret.png', 'private image');
  await f.write('posts/글.md', f.document({ body: '![[blog/assets/photo.png|360]]' }));
  await f.write('notes/메모.md', f.document({ slug: 'short-note', title: '짧은 메모' }));
  await f.write('notes/비공개.md', f.document({ slug: 'private-note', publish: false, body: '![[blog/assets/secret.png]]' }));
  const originalSource = await captureFiles(f.sourceDir);
  const result = await f.run();
  assert.equal(result.status, 'published');
  assert.equal(result.pushed, true);
  assert.equal(await f.head(), await f.remoteHead());
  assert.equal(await f.git('rev-list', '--count', `${baseline}..HEAD`), '1');
  assert.equal(await f.git('log', '-1', '--format=%s'), '[docs](blog): 공개 글·메모 변경 반영');
  const changed = (await f.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).split('\n');
  assert(changed.every((file) => managed.some((base) => file.startsWith(base + '/'))));
  assert.equal(await f.git('status', '--porcelain=v1', '-z'), '');
  const snapshot = await verifySnapshot(f.options);
  assert.equal(snapshot.entries.length, 2);
  assert.equal(snapshot.assets.length, 1);
  assert(!JSON.stringify(snapshot).includes('private-note'));
  assert.deepEqual(await captureFiles(f.sourceDir), originalSource);

  await f.write('posts/글.md', f.document({ publish: false, body: '![[blog/assets/photo.png|360]]' }));
  const beforeRemoval = await f.head();
  await f.run();
  const removed = await f.git('diff-tree', '--no-commit-id', '--diff-filter=D', '--name-only', '-r', 'HEAD');
  assert.match(removed, /apps\/blog\/src\/content\/posts\/hello\.md/);
  assert.match(removed, /apps\/blog\/public\/blog-assets\//);
  assert.equal(await f.git('rev-list', '--count', `${beforeRemoval}..HEAD`), '1');
  assert.deepEqual((await verifySnapshot(f.options)).entries.map((entry) => entry.kind), ['notes']);
});

test('변경 없는 발행은 커밋과 push를 만들지 않는다', async (t) => {
  const f = await createFixture(t);
  const before = await f.state();
  const counter = path.join(f.directory, 'push-count');
  await f.hook('pre-push', `printf x >> '${counter}'`);
  const result = await f.run();
  assert.equal(result.status, 'unchanged');
  assert.equal(result.pushed, false);
  assert.equal(await f.head(), before.head);
  assert.equal(await f.remoteHead(), before.remote);
  await assert.rejects(fs.access(counter));
  assert.equal(await f.git('diff', '--cached', '--name-only'), '');
});

test('dry-run은 fetch·sync·build·lock 없이 HEAD/index/output/remote를 보존한다', async (t) => {
  const f = await createFixture(t);
  await f.write('posts/new.md', f.document());
  const before = await f.state();
  const outputs = await captureFiles(path.join(f.repoDir, 'apps/blog'));
  const refs = await f.git('for-each-ref', '--format=%(refname) %(objectname)');
  const result = await f.run({
    dryRun: true,
    sync: async () => assert.fail('dry-run must not sync'),
    verify: async () => assert.fail('dry-run must not verify snapshot'),
    build: async () => assert.fail('dry-run must not build'),
  });
  assert.equal(result.status, 'dry-run');
  assert.equal(result.pushed, false);
  assert.deepEqual(await f.state(), before);
  assert.deepEqual(await captureFiles(path.join(f.repoDir, 'apps/blog')), outputs);
  assert.equal(await f.git('for-each-ref', '--format=%(refname) %(objectname)'), refs);
  await assert.rejects(fs.access(path.join(f.repoDir, '.git/blog-publish.lock')));
});

test('dry-run은 원격에 새 commit이 있어도 로컬 tracking ref를 fetch하지 않는다', async (t) => {
  const f = await createFixture(t);
  await f.peerCommit();
  const trackingBefore = await f.git('rev-parse', `refs/remotes/${f.remote}/${f.branch}`);
  const before = await f.state();
  await f.run({ dryRun: true });
  assert.equal(await f.git('rev-parse', `refs/remotes/${f.remote}/${f.branch}`), trackingBefore);
  assert.deepEqual(await f.state(), before);
});

test('기존 staged 변경은 managed 경로 안이어도 손대지 않고 중단한다', async (t) => {
  const f = await createFixture(t);
  await f.write('posts/one.md', f.document());
  await syncContent(f.options);
  await f.stageManaged();
  const before = await f.state();
  await assert.rejects(f.run());
  assert.deepEqual(await f.state(), before);
  assert.equal(f.buildCalls(), 0);
});

for (const kind of ['tracked', 'untracked']) {
  test(`콘텐츠 외 ${kind} 변경은 sync 전에 중단한다`, async (t) => {
    const f = await createFixture(t);
    await fs.writeFile(path.join(f.repoDir, kind === 'tracked' ? 'README.md' : 'new-code.js'), 'unrelated change\n');
    const before = await f.state();
    const snapshot = await captureFiles(path.join(f.repoDir, 'apps/blog'));
    await assert.rejects(f.run({ sync: async () => assert.fail('must stop before sync') }));
    assert.deepEqual(await f.state(), before);
    assert.deepEqual(await captureFiles(path.join(f.repoDir, 'apps/blog')), snapshot);
  });
}

test('detached HEAD, 잘못된 branch, upstream 불일치를 중단한다', async (t) => {
  for (const mode of ['detached', 'branch', 'upstream']) {
    await t.test(mode, async (sub) => {
      const f = await createFixture(sub);
      if (mode === 'detached') await f.git('switch', '--detach');
      if (mode === 'branch') await f.git('switch', '-c', 'feature');
      if (mode === 'upstream') await f.git('config', 'branch.main.merge', 'refs/heads/other');
      const before = await f.state();
      await assert.rejects(f.run());
      assert.deepEqual(await f.state(), before);
      assert.equal(f.buildCalls(), 0);
    });
  }
});

test('명시적으로 설정한 remote와 branch를 사용할 수 있다', async (t) => {
  const f = await createFixture(t, { branch: 'writing', remote: 'blog-remote' });
  await f.write('notes/note.md', f.document({ slug: 'custom-target' }));
  const result = await f.run();
  assert.equal(result.status, 'published');
  assert.equal(await f.head(), await f.remoteHead());
});

test('콘텐츠가 아닌 미push commit을 원격으로 보내지 않는다', async (t) => {
  const f = await createFixture(t);
  const originalRemote = await f.remoteHead();
  await fs.writeFile(path.join(f.repoDir, 'README.md'), 'code change\n');
  await f.git('add', '--', 'README.md');
  await f.git('commit', '-m', 'unpublished code');
  const head = await f.head();
  await assert.rejects(f.run());
  assert.equal(await f.head(), head);
  assert.equal(await f.remoteHead(), originalRemote);
  assert.equal(f.buildCalls(), 0);
});

test('remote보다 뒤처진 branch와 diverged branch를 자동 병합하거나 push하지 않는다', async (t) => {
  for (const diverged of [false, true]) {
    await t.test(diverged ? 'diverged' : 'behind', async (sub) => {
      const f = await createFixture(sub);
      if (diverged) {
        await f.write('posts/local.md', f.document());
        await syncContent(f.options);
        await f.stageManaged();
        await f.git('commit', '-m', 'local content');
      }
      await f.peerCommit();
      const before = await f.state();
      await assert.rejects(f.run());
      assert.equal(await f.head(), before.head);
      assert.equal(await f.remoteHead(), before.remote);
      assert.equal(await f.git('diff', '--cached', '--name-only'), '');
      assert.equal(f.buildCalls(), 0);
    });
  }
});

test('build 실패 시 stage·commit·push하지 않고 lock을 해제한다', async (t) => {
  const f = await createFixture(t);
  await f.write('posts/one.md', f.document());
  const before = await f.state();
  await assert.rejects(f.run({ build: async () => { throw new Error('simulated build failure'); } }));
  assert.equal(await f.head(), before.head);
  assert.equal(await f.remoteHead(), before.remote);
  assert.equal(await f.git('diff', '--cached', '--name-only'), '');
  await assert.rejects(fs.access(path.join(f.repoDir, '.git/blog-publish.lock')));
});

test('build 중 유효한 snapshot이 달라져도 stage 전에 중단한다', async (t) => {
  const f = await createFixture(t);
  await f.write('posts/one.md', f.document());
  const before = await f.state();
  await assert.rejects(f.run({ build: async () => {
    await f.write('notes/concurrent.md', f.document({ slug: 'concurrent' }));
    await syncContent(f.options);
  } }));
  assert.equal(await f.head(), before.head);
  assert.equal(await f.remoteHead(), before.remote);
  assert.equal(await f.git('diff', '--cached', '--name-only'), '');
});

test('build 중 콘텐츠 외 변경이나 새 staged 변경이 생기면 섞어 commit하지 않는다', async (t) => {
  for (const staged of [false, true]) {
    await t.test(staged ? 'staged' : 'dirty', async (sub) => {
      const f = await createFixture(sub);
      await f.write('posts/one.md', f.document());
      const before = await f.state();
      await assert.rejects(f.run({ build: async () => {
        await fs.writeFile(path.join(f.repoDir, 'README.md'), 'concurrent code\n');
        if (staged) await f.git('add', '--', 'README.md');
      } }));
      assert.equal(await f.head(), before.head);
      assert.equal(await f.remoteHead(), before.remote);
      const index = await f.git('diff', '--cached', '--name-only');
      assert.equal(index, staged ? 'README.md' : '');
    });
  }
});

test('Git clean filter가 staging 내용을 바꾸면 검증한 원문 대신 commit하지 않는다', async (t) => {
  const f = await createFixture(t);
  await fs.writeFile(path.join(f.repoDir, '.gitattributes'), 'apps/blog/src/content/**/*.md filter=publish-test\n');
  await f.git('add', '--', '.gitattributes');
  await f.git('commit', '-m', 'test filter attributes');
  await f.git('push', f.remote, f.branch);
  await f.git('config', 'filter.publish-test.clean', 'sed s/본문/필터변조/g');
  await f.git('config', 'filter.publish-test.smudge', 'cat');
  await f.git('config', 'filter.publish-test.required', 'true');
  await f.write('posts/one.md', f.document({ body: '본문' }));
  const before = await f.state();
  await assert.rejects(f.run());
  assert.equal(await f.head(), before.head);
  assert.equal(await f.remoteHead(), before.remote);
  assert.match(await f.git('diff', '--cached', '--name-only'), /apps\/blog\/src\/content\/posts\/hello\.md/);
  const indexBody = await f.git('show', ':apps/blog/src/content/posts/hello.md');
  assert.match(indexBody, /필터변조/);
  assert.match(await fs.readFile(path.join(f.repoDir, managed[0], 'posts/hello.md'), 'utf8'), /본문/);
});

test('발행 파일이 실행 가능 모드로 바뀌면 commit하지 않는다', async (t) => {
  const f = await createFixture(t);
  await f.git('config', 'core.filemode', 'true');
  await f.write('posts/one.md', f.document());
  const before = await f.state();
  await assert.rejects(f.run({ build: async () => {
    await fs.chmod(path.join(f.repoDir, managed[0], 'posts/hello.md'), 0o755);
  } }));
  assert.equal(await f.head(), before.head);
  assert.equal(await f.remoteHead(), before.remote);
  assert.match(await f.git('ls-files', '--stage', '--', managed[0] + '/posts/hello.md'), /^100755 /);
});

test('commit hook 거부 시 stage를 임의 reset하지 않고 push하지 않는다', async (t) => {
  const f = await createFixture(t);
  await f.write('posts/one.md', f.document());
  await f.hook('pre-commit', 'echo rejected >&2\nexit 1');
  const before = await f.state();
  await assert.rejects(f.run());
  assert.equal(await f.head(), before.head);
  assert.equal(await f.remoteHead(), before.remote);
  assert.match(await f.git('diff', '--cached', '--name-only'), /apps\/blog\/src\/content/);
  await assert.rejects(fs.access(path.join(f.repoDir, '.git/blog-publish.lock')));
});

test('push 실패 후 commit을 유지하고 재실행 시 중복 commit 없이 push를 재시도한다', async (t) => {
  const f = await createFixture(t);
  await f.write('posts/one.md', f.document());
  const hook = await f.hook('pre-receive', 'echo temporarily rejected >&2\nexit 1', true);
  const before = await f.state();
  await assert.rejects(f.run());
  const committed = await f.head();
  assert.notEqual(committed, before.head);
  assert.equal(await f.remoteHead(), before.remote);
  assert.equal(await f.git('rev-list', '--count', `${before.head}..HEAD`), '1');
  assert.equal(await f.git('status', '--porcelain=v1', '-z'), '');
  await fs.rm(hook);
  const result = await f.run();
  assert.equal(result.status, 'published');
  assert.equal(result.pushed, true);
  assert.equal(await f.head(), committed);
  assert.equal(await f.remoteHead(), committed);
  assert.equal(await f.git('rev-list', '--count', `${before.head}..HEAD`), '1');
});

test('기존 lock은 임의 삭제하지 않고 실행을 중단한다', async (t) => {
  const f = await createFixture(t);
  const lock = path.join(f.repoDir, '.git/blog-publish.lock');
  await fs.writeFile(lock, 'another publisher\n');
  const before = await f.state();
  await assert.rejects(f.run());
  assert.equal(await fs.readFile(lock, 'utf8'), 'another publisher\n');
  assert.deepEqual(await f.state(), before);
});

for (const operation of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'rebase-merge']) {
  test(`${operation} 진행 중에는 실행하지 않는다`, async (t) => {
    const f = await createFixture(t);
    const marker = path.join(f.repoDir, '.git', operation);
    if (operation === 'rebase-merge') await fs.mkdir(marker);
    else await fs.writeFile(marker, await f.head());
    const before = await f.state();
    await assert.rejects(f.run());
    assert.deepEqual(await f.state(), before);
  });
}

for (const flag of ['--assume-unchanged', '--skip-worktree']) {
  test(`${flag}로 숨겨진 파일 변경을 발행하지 않는다`, async (t) => {
    const f = await createFixture(t);
    await f.git('update-index', flag, '--', 'README.md');
    await fs.writeFile(path.join(f.repoDir, 'README.md'), 'hidden code change\n');
    const before = await f.state();
    await assert.rejects(f.run());
    assert.deepEqual(await f.state(), before);
  });
}

test('옵션으로 Git 인수나 refspec을 삽입할 수 없다', async (t) => {
  const f = await createFixture(t);
  const before = await f.state();
  for (const options of [{ remote: '--upload-pack=malicious' }, { branch: 'main:other' }, { branch: '../main' }, { remote: '' }]) {
    await assert.rejects(f.run(options));
  }
  assert.deepEqual(await f.state(), before);
});
