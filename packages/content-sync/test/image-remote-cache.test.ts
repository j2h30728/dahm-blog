import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import {
  createRemoteImageCache,
  type RemoteImageDescriptor,
  type RemoteSourceRecord,
} from "../src/image-remote-cache.js";
import { FakeS3 } from "./helpers/image-cache-fixture.js";

const owner = "123456789012";
const bucket = "images";
const transformVersion = "webp-v1-sharp-0.34.5-w640-960-1440";
const policyVersion = "delivery-v2-webp-v1";
const widths = [640, 960, 1440];
const indexKey = `blog-images/_cache/${policyVersion}/source-index.json`;

function sha(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("base64");
}

function source(hash: string, suffix = "a"): RemoteSourceRecord {
  return { hash, validatorUrlHash: sha(`validator-${suffix}`), etag: `\"remote-${suffix}\"` };
}

async function put(
  s3: FakeS3,
  key: string,
  bytes: Buffer,
  options: { contentType?: string; cacheControl?: string } = {},
): Promise<string> {
  const response = await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ExpectedBucketOwner: owner,
    ChecksumSHA256: checksum(bytes),
    ContentType: options.contentType,
    CacheControl: options.cacheControl,
  })) as { ETag: string };
  return response.ETag;
}

async function storedImage(s3: FakeS3, label = "one"): Promise<RemoteImageDescriptor> {
  const originalBytes = Buffer.from(`original-${label}-bytes`);
  const originalHash = sha(originalBytes);
  const variantBytes = Buffer.from(`webp-${label}`);
  const originalKey = `blog-images/${originalHash}/original.png`;
  const variantKey = `blog-images/${originalHash}/${transformVersion}/w640.webp`;
  const originalEtag = await put(s3, originalKey, originalBytes, { contentType: "image/png" });
  const variantEtag = await put(s3, variantKey, variantBytes, { contentType: "image/webp" });
  return {
    hash: originalHash,
    original: {
      key: originalKey,
      sha256: originalHash,
      byteLength: originalBytes.length,
      contentType: "image/png",
      etag: originalEtag,
    },
    variants: [{
      key: variantKey,
      sha256: sha(variantBytes),
      byteLength: variantBytes.length,
      contentType: "image/webp",
      etag: variantEtag,
      width: 640,
      height: 320,
    }],
    originalWidth: 1280,
    originalHeight: 640,
  };
}

function make(s3: Pick<S3Client, "send">, warnings: string[] = []) {
  return createRemoteImageCache({
    client: s3,
    bucket,
    expectedBucketOwner: owner,
    transformVersion,
    policyVersion,
    widths,
    warn: (message) => warnings.push(message),
  });
}

async function writeIndex(s3: FakeS3, sources: Record<string, RemoteSourceRecord>, images: Record<string, RemoteImageDescriptor>): Promise<void> {
  const bytes = Buffer.from(JSON.stringify({ version: 1, policyVersion, sources, images }));
  await put(s3, indexKey, bytes, { contentType: "application/json", cacheControl: "private, no-store" });
}

async function readIndex(s3: FakeS3): Promise<Record<string, unknown>> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: indexKey, ExpectedBucketOwner: owner })) as {
    Body: { transformToString(): Promise<string> };
  };
  return JSON.parse(await response.Body.transformToString()) as Record<string, unknown>;
}

test("cold miss는 index만 읽고 dirty가 아니면 저장하지 않는다", async () => {
  const s3 = new FakeS3();
  const cache = make(s3 as never);
  await cache.initialize();
  assert.equal(cache.source(sha("source")), undefined);
  assert.equal(cache.image(sha("image")), undefined);
  await cache.flush();
  assert.equal(s3.count("GetObjectCommand", "index"), 1);
  assert.equal(s3.count("ListObjectsV2Command"), 0);
  assert.equal(s3.count("PutObjectCommand", "index"), 0);
});

test("유효 index는 inventory 전체 페이지의 key·Size·opaque ETag가 맞을 때만 재사용한다", async () => {
  const s3 = new FakeS3(1);
  const image = await storedImage(s3);
  const identity = sha("source-one");
  const record = source(image.hash);
  await writeIndex(s3, { [identity]: record }, { [image.hash]: image });
  s3.resetCalls();

  const cache = make(s3 as never);
  await Promise.all([cache.initialize(), cache.initialize()]);
  assert.deepEqual(cache.source(identity), record);
  assert.deepEqual(cache.image(image.hash), image);
  assert.equal(s3.count("GetObjectCommand", "index"), 1, "initialize Promise를 공유해야 한다");
  assert.ok(s3.count("ListObjectsV2Command") >= 3, "inventory pagination을 끝까지 읽어야 한다");

  s3.objects.delete(image.variants[0].key);
  const missing = make(s3 as never);
  await missing.initialize();
  assert.equal(missing.source(identity), undefined);
  assert.equal(missing.image(image.hash), undefined);
});

test("malformed entry와 dependent source만 safe miss하고 다른 항목은 유지한다", async () => {
  const s3 = new FakeS3();
  const valid = await storedImage(s3, "valid");
  const invalid = await storedImage(s3, "invalid");
  invalid.variants[0].key = `blog-images/${invalid.hash}/${transformVersion}/w960.webp`;
  const validIdentity = sha("valid-source");
  const invalidIdentity = sha("invalid-source");
  await writeIndex(s3, {
    [validIdentity]: source(valid.hash, "valid"),
    [invalidIdentity]: source(invalid.hash, "invalid"),
  }, { [valid.hash]: valid, [invalid.hash]: invalid });

  const cache = make(s3 as never);
  await cache.initialize();
  assert.ok(cache.source(validIdentity));
  assert.ok(cache.image(valid.hash));
  assert.equal(cache.source(invalidIdentity), undefined);
  assert.equal(cache.image(invalid.hash), undefined);
});

test("손상된 index는 응답 ETag를 보존해 다음 flush에서 If-Match로 재구축한다", async () => {
  const s3 = new FakeS3();
  const invalidEtag = await put(s3, indexKey, Buffer.from("{invalid-json"));
  const warnings: string[] = [];
  const indexPuts: Array<Record<string, unknown>> = [];
  const client = {
    send: async (command: GetObjectCommand | ListObjectsV2Command | PutObjectCommand) => {
      if (command instanceof PutObjectCommand && String(command.input.Key).endsWith(".json")) {
        indexPuts.push(command.input as Record<string, unknown>);
      }
      return s3.send(command as never);
    },
  };
  const cache = make(client as never, warnings);
  await cache.initialize();
  const image = await storedImage(s3, "repair");
  cache.remember(sha("repair-source"), source(image.hash, "repair"), image);
  await cache.flush();

  assert.equal(warnings.length, 1);
  assert.equal(indexPuts.length, 1);
  assert.equal(indexPuts[0].IfMatch, invalidEtag);
  assert.equal(indexPuts[0].IfNoneMatch, undefined);
  const repaired = await readIndex(s3);
  assert.equal(repaired.version, 1);
});

test("cache read 403은 중단하고 기타 I/O 오류는 고정 경고 후 cold fallback한다", async () => {
  const forbidden = Object.assign(new Error("secret SDK error"), { $metadata: { httpStatusCode: 403 } });
  const denied = make({ send: async () => { throw forbidden; } } as never);
  await assert.rejects(denied.initialize(), /이미지 원격 캐시 접근 권한/);

  const warnings: string[] = [];
  const fallback = make({ send: async () => { throw new Error("token=must-not-log"); } } as never, warnings);
  await fallback.initialize();
  assert.equal(fallback.source(sha("source")), undefined);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes("must-not-log"), false);
});

test("remember는 S3 ETag가 빠진 descriptor를 기록하지 않는다", async () => {
  const s3 = new FakeS3();
  const cache = make(s3 as never);
  await cache.initialize();
  const image = await storedImage(s3);
  image.original.etag = "";
  cache.remember(sha("source"), source(image.hash), image);
  await cache.flush();
  assert.equal(s3.count("PutObjectCommand", "index"), 0);
});

test("dirty cache는 raw URL 없이 checksum·no-store·ExpectedBucketOwner·최초 CAS로 한 번 저장한다", async () => {
  const s3 = new FakeS3();
  const inputs: Array<Record<string, unknown>> = [];
  const client = {
    send: async (command: GetObjectCommand | ListObjectsV2Command | PutObjectCommand) => {
      if (command instanceof PutObjectCommand && String(command.input.Key).endsWith(".json")) {
        inputs.push(command.input as Record<string, unknown>);
      }
      return s3.send(command as never);
    },
  };
  const cache = make(client as never);
  await cache.initialize();
  const image = await storedImage(s3);
  const identity = sha("https://signed.example/image?token=secret");
  cache.remember(identity, source(image.hash), image);
  await cache.flush();
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].ExpectedBucketOwner, owner);
  assert.equal(inputs[0].IfNoneMatch, "*");
  assert.equal(inputs[0].CacheControl, "private, no-store");
  assert.equal(typeof inputs[0].ChecksumSHA256, "string");
  assert.equal(String(inputs[0].Body).includes("signed.example"), false);
  assert.equal(String(inputs[0].Body).includes("secret"), false);
});

test("기존 source와 descriptor를 그대로 remember하면 index를 다시 쓰지 않는다", async () => {
  const s3 = new FakeS3();
  const image = await storedImage(s3, "unchanged");
  const identity = sha("unchanged-source");
  const sourceRecord = source(image.hash, "unchanged");
  await writeIndex(s3, { [identity]: sourceRecord }, { [image.hash]: image });
  const cache = make(s3 as never);
  await cache.initialize();
  s3.resetCalls();

  cache.remember(identity, { ...sourceRecord, lastModified: undefined }, image);
  await cache.flush();
  assert.equal(s3.count("PutObjectCommand", "index"), 0);
});

test("CAS 충돌은 최신 index와 3-way merge하고 같은 source의 양쪽 변경은 다음 빌드 miss로 만든다", async () => {
  const s3 = new FakeS3();
  const localImage = await storedImage(s3, "local");
  const remoteImage = await storedImage(s3, "remote");
  const identity = sha("same-source");
  let injected = false;
  const client = {
    send: async (command: GetObjectCommand | ListObjectsV2Command | PutObjectCommand) => {
      if (!injected && command instanceof PutObjectCommand && String(command.input.Key).endsWith(".json")) {
        injected = true;
        await writeIndex(s3, { [identity]: source(remoteImage.hash, "remote") }, { [remoteImage.hash]: remoteImage });
      }
      return s3.send(command as never);
    },
  };
  const cache = make(client as never);
  await cache.initialize();
  cache.remember(identity, source(localImage.hash, "local"), localImage);
  await cache.flush();

  const saved = await readIndex(s3) as { sources: Record<string, unknown>; images: Record<string, unknown> };
  assert.equal(saved.sources[identity], undefined, "동시에 달라진 source는 제거해야 한다");
  assert.ok(saved.images[localImage.hash]);
  assert.ok(saved.images[remoteImage.hash]);
});

test("CAS가 계속 충돌하거나 Put403이어도 최대 3회 뒤 안전한 경고로 처리한다", async () => {
  for (const status of [412, 403]) {
    const s3 = new FakeS3();
    const warnings: string[] = [];
    let indexPuts = 0;
    const client = {
      send: async (command: GetObjectCommand | ListObjectsV2Command | PutObjectCommand) => {
        if (command instanceof PutObjectCommand && String(command.input.Key).endsWith(".json")) {
          indexPuts++;
          throw Object.assign(new Error("secret write error"), { $metadata: { httpStatusCode: status } });
        }
        return s3.send(command as never);
      },
    };
    const cache = make(client as never, warnings);
    await cache.initialize();
    const image = await storedImage(s3, `status-${status}`);
    cache.remember(sha(`source-${status}`), source(image.hash), image);
    await cache.flush();
    assert.equal(indexPuts, status === 412 ? 3 : 1);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].includes("secret"), false);
  }
});

test("inventory I/O fallback 뒤에는 기존 index를 축소해 덮어쓰지 않는다", async () => {
  const s3 = new FakeS3();
  const existing = await storedImage(s3, "existing");
  await writeIndex(s3, { [sha("existing-source")]: source(existing.hash, "existing") }, { [existing.hash]: existing });
  let indexPuts = 0;
  const warnings: string[] = [];
  const client = {
    send: async (command: GetObjectCommand | ListObjectsV2Command | PutObjectCommand) => {
      if (command instanceof ListObjectsV2Command) throw new Error("temporary list failure");
      if (command instanceof PutObjectCommand && String(command.input.Key).endsWith(".json")) indexPuts++;
      return s3.send(command as never);
    },
  };
  const cache = make(client as never, warnings);
  await cache.initialize();
  assert.equal(cache.source(sha("existing-source")), undefined);
  const added = await storedImage(s3, "added");
  cache.remember(sha("added-source"), source(added.hash, "added"), added);
  await cache.flush();
  assert.equal(indexPuts, 0);
  assert.equal(warnings.length, 1);
});

test("flush는 source/image 10000개 상한을 넘으면 index를 쓰지 않는다", async () => {
  const s3 = new FakeS3();
  const warnings: string[] = [];
  const cache = make(s3 as never, warnings);
  await cache.initialize();
  const image = await storedImage(s3, "limit");
  for (let index = 0; index <= 10_000; index++) {
    cache.remember(sha(`limit-source-${index}`), source(image.hash, String(index)), image);
  }
  await cache.flush();
  assert.equal(s3.count("PutObjectCommand", "index"), 0);
  assert.equal(warnings.length, 1);
});
