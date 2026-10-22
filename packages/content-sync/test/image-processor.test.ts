import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { assertImageResourceLimits, createImageProcessor, imageProcessingErrorMessage, imageVariantsForDelivery } from "../src/image-processor.js";
import { notionMarkdown } from "../src/notion-markdown.js";
import type { ImageAsset } from "../src/schema.js";

const publicAddress = async () => [{ address: "93.184.216.34" }];

test("작은 해상도가 더 큰 파일이면 모바일에도 더 선명하고 작은 파일을 제공한다", () => {
  const variants = [
    { width: 320, bytes: Buffer.alloc(5) },
    { width: 640, bytes: Buffer.alloc(34) },
    { width: 864, bytes: Buffer.alloc(10) },
    { width: 1440, bytes: Buffer.alloc(50) },
  ];
  assert.deepEqual(imageVariantsForDelivery(variants).map(({ width }) => width), [320, 864, 1440]);
  assert.equal(imageVariantsForDelivery([variants[1]])[0], variants[1]);
});

test("Sharp timeout을 변환 시간 초과로 분류하고 민감한 오류 원문은 노출하지 않는다", () => {
  const timeout = new Error("timeout: 100% complete\nVipsImage: killed\nwebpsave_buffer: anim add error");
  assert.equal(imageProcessingErrorMessage(timeout, "transform"), "이미지 최적화 실패 (변환): 이미지 변환 시간 제한 초과");
  const secret = new Error("https://example.com/file?token=must-not-log");
  assert.equal(imageProcessingErrorMessage(secret, "download"), "이미지 최적화 실패 (다운로드): 이미지 다운로드 오류");
  assert.equal(imageProcessingErrorMessage(secret, "transform"), "이미지 최적화 실패 (변환): 이미지 변환 오류");
  Object.assign(secret, { $metadata: { httpStatusCode: 403 } });
  assert.equal(imageProcessingErrorMessage(secret, "storage"), "이미지 최적화 실패 (저장): 이미지 저장 오류 (HTTP 403)");
  assert.match(imageProcessingErrorMessage(new Error("이미지 다운로드 재시도 한도 초과 (HTTP 503)"), "download"), /HTTP 503/);
});

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "image-processor-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

async function png(width = 1200, height = 600, color = "#336699"): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}

function imageResponse(bytes: Buffer, contentType: string): Response {
  return new Response(bytes, { headers: { "content-type": contentType, "content-length": String(bytes.length) } });
}

test("off 모드는 외부 이미지를 처리하지 않고 빈 프로세서를 사용한다", () => {
  assert.equal(createImageProcessor({ root: "/tmp", workRoot: "/tmp", env: {} }), undefined);
});

test("실제 152프레임 GIF 규모는 허용하고 픽셀·프레임 상한 초과는 거부한다", () => {
  assert.doesNotThrow(() => assertImageResourceLimits(864, 864, 152));
  assert.throws(() => assertImageResourceLimits(1000, 1000, 129), /픽셀 또는 프레임 제한/);
  assert.throws(() => assertImageResourceLimits(5000, 5000, 1), /픽셀 또는 프레임 제한/);
  assert.throws(() => assertImageResourceLimits(1, 1, 201), /픽셀 또는 프레임 제한/);
});

test("local 모드는 실측 반응형 WebP와 원본을 만들고 같은 URL을 실행 중 한 번만 받는다", async (t) => {
  const root = workspace(t);
  const source = await png(2000, 1000);
  let requests = 0;
  const processor = createImageProcessor({
    root,
    workRoot: root,
    env: { IMAGE_ASSETS_MODE: "local" },
    resolver: publicAddress,
    fetcher: async () => { requests++; return imageResponse(source, "image/png"); },
  });
  assert.ok(processor);
  const [asset, duplicate] = await Promise.all([
    processor.process("https://velog.velcdn.com/images/example/image.png"),
    processor.process("https://velog.velcdn.com/images/example/image.png"),
  ]);
  assert.deepEqual(asset, duplicate);
  assert.equal(requests, 1);
  assert.deepEqual(asset.variants.map(({ width }) => width), [640, 960, 1440]);
  assert.equal(asset.width, 960);
  assert.equal(asset.height, 480);
  assert.equal(asset.originalWidth, 2000);
  assert.equal(asset.originalHeight, 1000);
  assert.equal(processor.manifest.images[asset.src]?.originalSrc, asset.originalSrc);

  const resolveAsset = (url: string) => path.join(root, "assets", decodeURIComponent(url.replace("/post-assets/", "")));
  assert.equal(readFileSync(resolveAsset(asset.originalSrc)).equals(source), true);
  for (const variant of asset.variants) {
    assert.equal(existsSync(resolveAsset(variant.src)), true);
    const metadata = await sharp(readFileSync(resolveAsset(variant.src))).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, variant.width);
  }

  const nextWorkRoot = path.join(root, "next-run");
  const cachedProcessor = createImageProcessor({
    root,
    workRoot: nextWorkRoot,
    env: { IMAGE_ASSETS_MODE: "local" },
    resolver: publicAddress,
    fetcher: async () => { requests++; return imageResponse(source, "image/png"); },
  })!;
  assert.deepEqual(await cachedProcessor.process("https://velog.velcdn.com/images/example/image.png"), asset);
  assert.equal(requests, 2, "다음 실행도 원본 바이트 변경을 확인하기 위해 다시 다운로드한다");
  assert.equal(existsSync(path.join(root, ".content-sync/image-cache/descriptors")), true);
  assert.equal(existsSync(path.join(nextWorkRoot, "assets", asset.src.replace("/post-assets/", ""))), true);
});

test("같은 URL의 바이트가 다음 실행에서 바뀌면 콘텐츠 해시 경로도 바뀐다", async (t) => {
  const root = workspace(t);
  const sources = [await png(20, 10, "red"), await png(20, 10, "blue")];
  const assets: ImageAsset[] = [];
  for (const source of sources) {
    const processor = createImageProcessor({
      root,
      workRoot: root,
      env: { IMAGE_ASSETS_MODE: "local" },
      resolver: publicAddress,
      fetcher: async () => imageResponse(source, "image/png"),
    });
    assets.push(await processor!.process("https://i.ibb.co/example/image.png"));
  }
  assert.notEqual(assets[0].src, assets[1].src);
  assert.notEqual(assets[0].originalSrc, assets[1].originalSrc);
});

test("animated GIF의 프레임·지연·반복과 원본 바이트를 보존한다", async (t) => {
  const root = workspace(t);
  const gif = Buffer.from(
    "47494638396101000100800000000000ffffff21ff0b4e45545343415045322e300301000000"
    + "21f904000a0000002c0000000001000100000202440100"
    + "21f904000a0000002c00000000010001000002024c01003b",
    "hex",
  );
  const processor = createImageProcessor({
    root,
    workRoot: root,
    env: { IMAGE_ASSETS_MODE: "local" },
    resolver: publicAddress,
    fetcher: async () => imageResponse(gif, "image/gif"),
  })!;
  const asset = await processor.process("https://velog.velcdn.com/images/example/animated.gif");
  const resolveAsset = (url: string) => path.join(root, "assets", decodeURIComponent(url.replace("/post-assets/", "")));
  assert.equal(readFileSync(resolveAsset(asset.originalSrc)).equals(gif), true);
  const metadata = await sharp(readFileSync(resolveAsset(asset.src)), { animated: true }).metadata();
  assert.equal(metadata.pages, 2);
  assert.deepEqual(metadata.delay, [100, 100]);
  assert.equal(metadata.loop, 0);
});

test("다운로드는 신뢰 호스트와 공개 주소만 허용하고 리다이렉트도 다시 검사한다", async (t) => {
  const root = workspace(t);
  const make = (resolver: typeof publicAddress, fetcher: typeof fetch) => createImageProcessor({
    root, workRoot: root, env: { IMAGE_ASSETS_MODE: "local" }, resolver, fetcher,
  })!;
  await assert.rejects(
    make(publicAddress, fetch).process("https://example.com/image.png"),
    /이미지 최적화 실패/,
  );
  let requests = 0;
  await assert.rejects(
    make(async () => [{ address: "127.0.0.1" }], async () => { requests++; return imageResponse(await png(1, 1), "image/png"); })
      .process("https://i.ibb.co/image.png"),
    /이미지 최적화 실패/,
  );
  assert.equal(requests, 0);
  await assert.rejects(
    make(publicAddress, async () => new Response(null, { status: 302, headers: { location: "https://example.com/private.png" } }))
      .process("https://i.ibb.co/image.png"),
    /이미지 최적화 실패/,
  );
  await assert.rejects(
    make(publicAddress, async () => new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/png", "content-length": String(25 * 1024 * 1024 + 1) },
    })).process("https://i.ibb.co/large.png"),
    /이미지 크기 제한 초과/,
  );
});

test("s3 모드는 버킷 소유자를 모든 요청에서 고정하고 checksum이 맞는 객체만 재사용한다", async (t) => {
  const root = workspace(t);
  const source = await png(2, 2);
  const stored = new Map<string, { sha256: string; checksum: string }>();
  const commands: Array<{ name: string; input: Record<string, unknown> }> = [];
  const client = {
    async send(command: HeadObjectCommand | PutObjectCommand) {
      commands.push({ name: command.constructor.name, input: command.input as Record<string, unknown> });
      assert.equal(command.input.ExpectedBucketOwner, "123456789012");
      const key = String(command.input.Key);
      if (command instanceof PutObjectCommand) {
        const bytes = command.input.Body as Buffer;
        const checksum = createHash("sha256").update(bytes).digest("base64");
        assert.equal(command.input.ChecksumSHA256, checksum);
        stored.set(key, { sha256: String(command.input.Metadata?.sha256), checksum });
        return {};
      }
      const value = stored.get(key);
      if (!value) throw Object.assign(new Error("missing"), { $metadata: { httpStatusCode: 404 } });
      return { Metadata: { sha256: value.sha256 }, ChecksumSHA256: value.checksum };
    },
  };
  const env = {
    IMAGE_ASSETS_MODE: "s3",
    IMAGE_S3_BUCKET: "personal-blog-images",
    IMAGE_CDN_BASE_URL: "https://cdn.example.com/assets",
    IMAGE_AWS_ACCOUNT_ID: "123456789012",
    AWS_REGION: "ap-northeast-2",
    AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/test-images",
    VERCEL_OIDC_TOKEN: "test-token-never-sent",
  };
  const processor = createImageProcessor({
    root, workRoot: root, env, resolver: publicAddress,
    fetcher: async () => imageResponse(source, "image/png"), s3Client: client as never,
  })!;
  const asset = await processor.process("https://i.ibb.co/image.png");
  assert.match(asset.src, /^https:\/\/cdn\.example\.com\/assets\/blog-images\//);
  assert.equal(commands.filter(({ name }) => name === "PutObjectCommand").length, 2);

  const freshRoot = workspace(t);
  const reused = createImageProcessor({
    root: freshRoot, workRoot: freshRoot, env, resolver: publicAddress,
    fetcher: async () => imageResponse(source, "image/png"), s3Client: client as never,
  })!;
  await reused.process("https://i.ibb.co/image.png");
  assert.equal(commands.filter(({ name }) => name === "PutObjectCommand").length, 2);
});

test("s3 모드는 필수 설정을 검증하고 404가 아닌 Head 오류를 누락으로 처리하지 않는다", async (t) => {
  const root = workspace(t);
  assert.throws(() => createImageProcessor({ root, workRoot: root, env: { IMAGE_ASSETS_MODE: "s3" } }), /IMAGE_AWS_ACCOUNT_ID/);
  const processor = createImageProcessor({
    root,
    workRoot: root,
    env: {
      IMAGE_ASSETS_MODE: "s3", IMAGE_S3_BUCKET: "bucket", IMAGE_CDN_BASE_URL: "https://cdn.example.com",
      IMAGE_AWS_ACCOUNT_ID: "123456789012", AWS_REGION: "ap-northeast-2",
      AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/test-images", VERCEL_OIDC_TOKEN: "test-token-never-sent",
    },
    resolver: publicAddress,
    fetcher: async () => imageResponse(await png(1, 1), "image/png"),
    s3Client: { send: async () => { throw Object.assign(new Error("forbidden"), { $metadata: { httpStatusCode: 403 } }); } } as never,
  })!;
  await assert.rejects(processor.process("https://i.ibb.co/image.png"), /이미지 최적화 실패/);
});

test("Markdown의 모든 일반 이미지는 callback 결과를 쓰고 비이미지 미디어는 기존 출력을 유지한다", async (t) => {
  const root = workspace(t);
  const sources: string[] = [];
  const asset: ImageAsset = {
    src: "https://cdn.example.com/optimized.webp",
    originalSrc: "https://cdn.example.com/original.png",
    width: 640,
    height: 320,
    originalWidth: 1200,
    originalHeight: 600,
    variants: [{ src: "https://cdn.example.com/optimized.webp", width: 640 }],
  };
  const result = await notionMarkdown(
    "![외부](https://velog.velcdn.com/images/a.png)\n![노션](https://prod-files-secure.s3.us-west-2.amazonaws.com/a.png)\n![영상](https://example.com/a.mp4)",
    { workRoot: root, pageId: "page", slugs: new Map(), processImage: async (source) => { sources.push(source); return asset; } },
  );
  assert.equal(sources.length, 2);
  assert.equal((result.match(/optimized\.webp/g) ?? []).length, 2);
  assert.match(result, /<video className="media-embed media-embed-video"/);
});
