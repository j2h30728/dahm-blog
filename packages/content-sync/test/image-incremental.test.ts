import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { createImageProcessor } from "../src/image-processor.js";
import {
  FakeRemote,
  FakeS3,
  incremental,
  publicAddress,
  s3Env,
  type IncrementalProcessor,
} from "./helpers/image-cache-fixture.js";

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "image-incremental-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function processor(
  t: { after: (fn: () => void) => void }, s3: FakeS3, remote: FakeRemote,
): IncrementalProcessor {
  const root = workspace(t);
  return incremental(createImageProcessor({
    root,
    workRoot: root,
    env: s3Env,
    resolver: publicAddress,
    fetcher: remote.fetch,
    s3Client: s3 as never,
  })!);
}

async function tinyPng(index: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: index & 255, g: (index >> 8) & 255, b: (index * 17) & 255, alpha: 1 },
    },
  }).png({ compressionLevel: 0 }).toBuffer();
}

async function bootstrap(
  t: { after: (fn: () => void) => void }, s3: FakeS3, remote: FakeRemote, urls: string[],
): Promise<IncrementalProcessor> {
  const initial = processor(t, s3, remote);
  for (const url of urls) await initial.process(url);
  await initial.flush();
  return initial;
}

test("400개가 그대로면 원격 validator와 S3 인덱스만 확인하고, 1개 변경 시 그 이미지 하나만 다시 처리한다", async (t) => {
  const s3 = new FakeS3(100);
  const remote = new FakeRemote();
  const urls = Array.from({ length: 400 }, (_, index) => `https://i.ibb.co/cache/image-${index}.png`);
  const sources = await Promise.all(urls.map((_, index) => tinyPng(index)));
  urls.forEach((url, index) => remote.set(url, { bytes: sources[index], etag: `"image-${index}-v1"` }));

  const initial = await bootstrap(t, s3, remote, urls);
  assert.equal(initial.stats.checked, 400);
  assert.equal(s3.count("PutObjectCommand", "index"), 1, "전체 처리가 끝난 뒤 source index를 한 번 저장한다");

  s3.resetCalls();
  remote.calls.length = 0;
  const warm = processor(t, s3, remote);
  const started = performance.now();
  for (const url of urls) await warm.process(url);
  await warm.flush();
  const unchangedMs = performance.now() - started;

  assert.deepEqual(warm.stats, { checked: 400, downloaded: 0, reused: 400, transformed: 0, uploaded: 0 });
  assert.equal(remote.calls.length, 400);
  assert.equal(remote.calls.filter(({ status }) => status === 304).length, 400);
  assert.equal(s3.count("GetObjectCommand", "index"), 1);
  assert.ok(s3.count("ListObjectsV2Command") > 1, "여러 페이지의 S3 inventory를 끝까지 읽는다");
  assert.equal(s3.count("HeadObjectCommand", "image"), 0);
  assert.equal(s3.count("PutObjectCommand", "image"), 0);
  assert.equal(s3.count("PutObjectCommand", "index"), 0, "변경이 없으면 index도 다시 쓰지 않는다");
  t.diagnostic(`400 unchanged: ${unchangedMs.toFixed(1)}ms, ${JSON.stringify(warm.stats)}`);

  const changedIndex = 217;
  const changed = await tinyPng(1000);
  assert.equal(changed.length, sources[changedIndex].length, "같은 길이의 새 바이트 fixture를 사용한다");
  remote.set(urls[changedIndex], { bytes: changed, etag: `"image-${changedIndex}-v2"` });
  s3.resetCalls();
  remote.calls.length = 0;
  const oneChanged = processor(t, s3, remote);
  const changedStarted = performance.now();
  for (const url of urls) await oneChanged.process(url);
  await oneChanged.flush();
  const changedMs = performance.now() - changedStarted;

  assert.equal(oneChanged.stats.checked, 400);
  assert.equal(oneChanged.stats.downloaded, 1);
  assert.equal(oneChanged.stats.reused, 399);
  assert.equal(oneChanged.stats.transformed, 1);
  assert.ok(oneChanged.stats.uploaded > 0);
  assert.equal(remote.calls.filter(({ status }) => status === 304).length, 399);
  assert.equal(remote.calls.filter(({ status }) => status === 200).length, 1);
  assert.ok(s3.count("PutObjectCommand", "image") > 0);
  assert.equal(s3.count("PutObjectCommand", "index"), 1);
  t.diagnostic(`399 unchanged + 1 changed: ${changedMs.toFixed(1)}ms, ${JSON.stringify(oneChanged.stats)}`);
});

test("redirect 최종 응답의 validator만 재검증 요청에 사용한다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const source = "https://notionusercontent.com/image/source";
  const target = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/image.png?signature=current";
  const bytes = await tinyPng(1);
  remote.set(source, { bytes: Buffer.alloc(0), redirect: target });
  remote.set(target, { bytes, etag: '"redirect-target-v1"' });
  await bootstrap(t, s3, remote, [source]);

  remote.calls.length = 0;
  const warm = processor(t, s3, remote);
  await warm.process(source);
  await warm.flush();

  assert.equal(remote.calls.length, 2);
  assert.deepEqual(remote.calls[0], { url: source, method: "GET", ifNoneMatch: null, ifModifiedSince: null, status: 302 });
  assert.deepEqual(remote.calls[1], {
    url: target, method: "GET", ifNoneMatch: '"redirect-target-v1"', ifModifiedSince: null, status: 304,
  });
  assert.deepEqual(warm.stats, { checked: 1, downloaded: 0, reused: 1, transformed: 0, uploaded: 0 });
});

test("잘못된 ETag는 저장하지 않고 유효한 Last-Modified로 변경을 확인한다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const url = "https://i.ibb.co/cache/invalid-etag.png";
  const lastModified = "Wed, 21 Oct 2026 12:07:00 GMT";
  remote.set(url, { bytes: await tinyPng(9), lastModified });
  const fetchRemote = remote.fetch;
  remote.fetch = async (input, init) => {
    const response = await fetchRemote(input, init);
    response.headers.set("etag", "not-a-valid-http-etag");
    return response;
  };
  await bootstrap(t, s3, remote, [url]);
  remote.calls.length = 0;
  const warm = processor(t, s3, remote);
  await warm.process(url);
  await warm.flush();
  assert.equal(remote.calls[0].ifNoneMatch, null);
  assert.equal(remote.calls[0].ifModifiedSince, lastModified);
  assert.equal(remote.calls[0].status, 304);
  assert.deepEqual(warm.stats, { checked: 1, downloaded: 0, reused: 1, transformed: 0, uploaded: 0 });
});

test("Notion X-Amz-Signature가 바뀌어도 같은 pathname의 source cache를 재사용한다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const oldUrl = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/image.png?X-Amz-Signature=old";
  const newUrl = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/image.png?X-Amz-Signature=new";
  const bytes = await tinyPng(2);
  remote.set(oldUrl, { bytes, etag: '"signed-v1"' });
  remote.set(newUrl, { bytes, etag: '"signed-v1"' });
  await bootstrap(t, s3, remote, [oldUrl]);

  remote.calls.length = 0;
  const renewed = processor(t, s3, remote);
  await renewed.process(newUrl);
  await renewed.flush();

  assert.equal(remote.calls.length, 1);
  assert.equal(remote.calls[0].ifNoneMatch, '"signed-v1"');
  assert.equal(remote.calls[0].status, 304);
  assert.deepEqual(renewed.stats, { checked: 1, downloaded: 0, reused: 1, transformed: 0, uploaded: 0 });
});

test("validator가 없으면 매번 바이트를 받아 hash하고, 같은 길이의 새 바이트도 변경으로 잡는다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const url = "https://i.ibb.co/cache/no-validator.png";
  const first = await tinyPng(3);
  const second = await tinyPng(4);
  assert.equal(first.length, second.length);
  remote.set(url, { bytes: first });
  const initial = await bootstrap(t, s3, remote, [url]);
  const initialSrc = (await initial.process(url)).src;

  const unchanged = processor(t, s3, remote);
  const reused = await unchanged.process(url);
  await unchanged.flush();
  assert.equal(reused.src, initialSrc);
  assert.deepEqual(unchanged.stats, { checked: 1, downloaded: 1, reused: 1, transformed: 0, uploaded: 0 });

  remote.set(url, { bytes: second });
  const changed = processor(t, s3, remote);
  const replaced = await changed.process(url);
  await changed.flush();
  assert.notEqual(replaced.src, initialSrc);
  assert.equal(changed.stats.downloaded, 1);
  assert.equal(changed.stats.transformed, 1);
  assert.ok(changed.stats.uploaded > 0);
});

test("inventory에서 캐시된 변환 객체가 누락되면 원본으로 해당 결과만 복구한다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const url = "https://i.ibb.co/cache/missing-object.png";
  remote.set(url, { bytes: await tinyPng(5), etag: '"missing-v1"' });
  const initial = await bootstrap(t, s3, remote, [url]);
  const expected = (await initial.process(url)).src;
  const missingKey = s3.deleteImageObject();

  s3.resetCalls();
  remote.calls.length = 0;
  const repaired = processor(t, s3, remote);
  const actual = await repaired.process(url);
  await repaired.flush();

  assert.equal(actual.src, expected);
  assert.equal(remote.calls[0].ifNoneMatch, null, "누락 객체 복구는 stale validator를 보내지 않는다");
  assert.equal(remote.calls[0].status, 200);
  assert.equal(repaired.stats.downloaded, 1);
  assert.equal(repaired.stats.transformed, 1);
  assert.ok(repaired.stats.uploaded > 0);
  assert.equal(s3.objects.has(missingKey), true);
});

test("실제 GET의 Last-Modified로 재검증하고 ETag가 있으면 If-None-Match만 보낸다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const lastModifiedUrl = "https://velog.velcdn.com/images/cache/last-modified.png";
  const etagUrl = "https://i.ibb.co/cache/etag-priority.png";
  const date = "Wed, 21 Oct 2026 15:15:19 GMT";
  remote.set(lastModifiedUrl, { bytes: await tinyPng(6), lastModified: date });
  remote.set(etagUrl, { bytes: await tinyPng(7), etag: '"etag-priority-v1"', lastModified: date });
  await bootstrap(t, s3, remote, [lastModifiedUrl, etagUrl]);

  remote.calls.length = 0;
  const warm = processor(t, s3, remote);
  await warm.process(lastModifiedUrl);
  await warm.process(etagUrl);
  await warm.flush();

  assert.equal(remote.calls.length, 2);
  assert.deepEqual(remote.calls[0], {
    url: lastModifiedUrl, method: "GET", ifNoneMatch: null, ifModifiedSince: date, status: 304,
  });
  assert.deepEqual(remote.calls[1], {
    url: etagUrl, method: "GET", ifNoneMatch: '"etag-priority-v1"', ifModifiedSince: null, status: 304,
  });
  assert.ok(remote.calls.every(({ method }) => method === "GET"), "validator 확인에 HEAD를 사용하지 않는다");
});

test("Notion 서명 필드만 제거하고 versionId와 외부 host query는 source identity에 유지한다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const bytes = await tinyPng(8);
  const notionV1Old = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/versioned.png?versionId=v1&X-Amz-Signature=old";
  const notionV1New = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/versioned.png?versionId=v1&X-Amz-Signature=new";
  const notionV2 = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/versioned.png?versionId=v2&X-Amz-Signature=new";
  const externalOld = "https://i.ibb.co/cache/query.png?width=640&X-Amz-Signature=old";
  const externalNew = "https://i.ibb.co/cache/query.png?width=640&X-Amz-Signature=new";
  for (const url of [notionV1Old, notionV1New, notionV2, externalOld, externalNew]) {
    remote.set(url, { bytes, etag: '"query-v1"' });
  }
  await bootstrap(t, s3, remote, [notionV1Old, externalOld]);

  remote.calls.length = 0;
  const next = processor(t, s3, remote);
  await next.process(notionV1New);
  await next.process(notionV2);
  await next.process(externalNew);
  await next.flush();

  assert.equal(remote.calls[0].ifNoneMatch, '"query-v1"', "Notion 서명만 바뀌면 기존 validator를 쓴다");
  assert.equal(remote.calls[0].status, 304);
  assert.equal(remote.calls[1].ifNoneMatch, null, "versionId가 바뀌면 별도 source로 확인한다");
  assert.equal(remote.calls[1].status, 200);
  assert.equal(remote.calls[2].ifNoneMatch, null, "외부 host의 X-Amz-Signature는 임의로 제거하지 않는다");
  assert.equal(remote.calls[2].status, 200);
});

test("origin이 conditional 400·412를 반환하면 validator 없이 한 번 다시 받아 hash한다", async (t) => {
  for (const conditionalStatus of [400, 412] as const) {
    const s3 = new FakeS3();
    const remote = new FakeRemote();
    const url = `https://i.ibb.co/cache/conditional-${conditionalStatus}.png`;
    const record = { bytes: await tinyPng(conditionalStatus), etag: `"conditional-${conditionalStatus}"` };
    remote.set(url, record);
    await bootstrap(t, s3, remote, [url]);
    remote.set(url, { ...record, conditionalStatus });

    remote.calls.length = 0;
    const fallback = processor(t, s3, remote);
    await fallback.process(url);
    await fallback.flush();

    assert.equal(remote.calls.length, 2);
    assert.equal(remote.calls[0].ifNoneMatch, record.etag);
    assert.equal(remote.calls[0].status, conditionalStatus);
    assert.equal(remote.calls[1].ifNoneMatch, null);
    assert.equal(remote.calls[1].ifModifiedSince, null);
    assert.equal(remote.calls[1].status, 200);
    assert.deepEqual(fallback.stats, { checked: 1, downloaded: 1, reused: 1, transformed: 0, uploaded: 0 });
  }
});

test("원본 네트워크 오류가 나면 검증하지 못한 stale cache로 성공하지 않는다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const url = "https://i.ibb.co/cache/network-error.png";
  remote.set(url, { bytes: await tinyPng(9), etag: '"network-v1"' });
  await bootstrap(t, s3, remote, [url]);
  remote.set(url, { bytes: Buffer.alloc(0), error: new TypeError("secret origin reset") });

  remote.calls.length = 0;
  const failed = processor(t, s3, remote);
  await assert.rejects(failed.process(url), /이미지 최적화 실패/);
  assert.equal(remote.calls.length, 3, "기존 제한만큼 재시도한 뒤 실패한다");
  assert.equal(failed.manifest.images && Object.keys(failed.manifest.images).length, 0);
});

test("inventory의 ETag가 같은 크기에서 달라지면 cache를 쓰지 않고 원본·S3 checksum을 다시 검증한다", async (t) => {
  const s3 = new FakeS3();
  const remote = new FakeRemote();
  const url = "https://i.ibb.co/cache/tampered-object.png";
  remote.set(url, { bytes: await tinyPng(10), etag: '"tampered-v1"' });
  await bootstrap(t, s3, remote, [url]);
  const key = s3.tamperImageObjectSameSize();
  const size = s3.objects.get(key)!.bytes.length;

  remote.calls.length = 0;
  const repaired = processor(t, s3, remote);
  await assert.rejects(repaired.process(url), /S3 이미지 객체 검증 실패/);

  assert.equal(remote.calls[0].ifNoneMatch, null);
  assert.equal(remote.calls[0].status, 200);
  assert.equal(s3.objects.get(key)!.bytes.length, size);
});
