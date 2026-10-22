import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ChecksumMode,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import type { Fetch } from "./notion-client.js";
import type { ImageAsset, ImageManifest } from "./schema.js";
import { imageS3Config } from "./image-s3-config.js";

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_DOWNLOAD_ATTEMPTS = 3;
const MAX_FRAMES = 200;
const MAX_FRAME_PIXELS = 24_000_000;
const MAX_TOTAL_PIXELS = 128_000_000;
const MAX_TRANSFORM_MS = 30_000;
const MAX_ANIMATED_TRANSFORM_MS = 120_000;
const WIDTHS = [640, 960, 1440] as const;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const TRANSFORM_VERSION = `webp-v1-sharp-${sharp.versions.sharp}-w${WIDTHS.join("-")}`;

export type ImageAssetsMode = "off" | "local" | "s3";

export interface ImageProcessor {
  readonly manifest: ImageManifest;
  process(source: string): Promise<ImageAsset>;
}

export interface ImageProcessorFactoryOptions {
  root: string;
  workRoot: string;
  env?: NodeJS.ProcessEnv;
  fetcher?: Fetch;
  resolver?: (hostname: string) => Promise<ReadonlyArray<{ address: string }>>;
  s3Client?: Pick<S3Client, "send">;
}

interface DownloadedImage {
  bytes: Buffer;
  contentType: string;
}

interface StoredImage {
  bytes: Buffer;
  key: string;
  contentType: string;
  sha256: string;
}

interface CachedTransform {
  version: 1;
  transformVersion: string;
  hash: string;
  original: Omit<StoredImage, "bytes">;
  variants: Array<Omit<StoredImage, "bytes"> & { width: number; height: number }>;
  originalWidth: number;
  originalHeight: number;
}

function trustedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "velog.velcdn.com"
    || host === "i.ibb.co"
    || host === "notion.so"
    || host.endsWith(".notion.so")
    || host === "notion-static.com"
    || host.endsWith(".notion-static.com")
    || host === "notionusercontent.com"
    || host.endsWith(".notionusercontent.com")
    || /^prod-files-secure\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host);
}

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")
    || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224;
}

async function validateRemoteUrl(
  value: string,
  resolver: (hostname: string) => Promise<ReadonlyArray<{ address: string }>>,
): Promise<URL> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("이미지 URL 형식 오류"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !trustedHost(url.hostname)) {
    throw new Error("허용되지 않은 이미지 URL");
  }
  let addresses: ReadonlyArray<{ address: string }>;
  try { addresses = await resolver(url.hostname); }
  catch { throw new Error("이미지 호스트 확인 실패"); }
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) {
    throw new Error("이미지 호스트 주소가 안전하지 않습니다");
  }
  return url;
}

async function responseBytes(response: Response): Promise<Buffer> {
  if (!response.body) throw new Error("이미지 응답 본문 없음");
  const announced = Number(response.headers.get("content-length"));
  if (Number.isFinite(announced) && announced > MAX_DOWNLOAD_BYTES) throw new Error("이미지 크기 제한 초과");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DOWNLOAD_BYTES) {
      await reader.cancel();
      throw new Error("이미지 크기 제한 초과");
    }
    chunks.push(value);
  }
  if (!size) throw new Error("빈 이미지 응답");
  return Buffer.concat(chunks);
}

async function downloadImage(
  source: string,
  fetcher: Fetch,
  resolver: (hostname: string) => Promise<ReadonlyArray<{ address: string }>>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<DownloadedImage> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    let url = await validateRemoteUrl(source, resolver);
    try {
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        const response = await fetcher(url.href, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || redirects === MAX_REDIRECTS) throw new Error("이미지 리다이렉트 제한 초과");
          url = await validateRemoteUrl(new URL(location, url).href, resolver);
          continue;
        }
        lastStatus = response.status;
        if (!response.ok) {
          await response.body?.cancel();
          if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt + 1 < MAX_DOWNLOAD_ATTEMPTS) break;
          throw new Error(`이미지 HTTP ${response.status}`);
        }
        const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
        if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
          await response.body?.cancel();
          throw new Error("지원하지 않는 이미지 형식");
        }
        return { bytes: await responseBytes(response), contentType };
      }
    } catch (error) {
      if (attempt + 1 >= MAX_DOWNLOAD_ATTEMPTS || (error instanceof Error && /허용되지 않은|제한 초과|지원하지 않는/.test(error.message))) throw error;
    }
    await sleep(250 * 2 ** attempt);
  }
  throw new Error(`이미지 다운로드 재시도 한도 초과${lastStatus ? ` (HTTP ${lastStatus})` : ""}`);
}

function originalExtension(format: string | undefined, contentType: string): string {
  const formats: Record<string, string> = { jpeg: "jpg", png: "png", gif: "gif", webp: "webp", avif: "avif", tiff: "tiff", heif: "heif" };
  const mime: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif", "image/tiff": "tiff", "image/heif": "heif" };
  const extension = formats[format ?? ""] ?? mime[contentType];
  if (!extension) throw new Error("원본 이미지 확장자를 결정할 수 없습니다");
  return extension;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function publicUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function localUrl(key: string): string {
  return `/post-assets/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function orientedSize(width: number, height: number, orientation?: number): { width: number; height: number } {
  return orientation && orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

export function assertImageResourceLimits(width: number, frameHeight: number, pages: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(frameHeight) || !Number.isInteger(pages)
    || width <= 0 || frameHeight <= 0 || pages <= 0 || pages > MAX_FRAMES
    || width * frameHeight > MAX_FRAME_PIXELS || width * frameHeight * pages > MAX_TOTAL_PIXELS) {
    throw new Error("이미지 픽셀 또는 프레임 제한 초과");
  }
}

function cacheDescriptorPath(cacheRoot: string, hash: string): string {
  return path.join(cacheRoot, "descriptors", hash, `${TRANSFORM_VERSION}.json`);
}

function storedPath(root: string, key: string): string {
  return path.join(root, ...key.split("/"));
}

function validSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function parseCachedTransform(
  value: unknown,
  expected: { hash: string; originalWidth: number; originalHeight: number; widths: number[] },
): CachedTransform {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("이미지 변환 캐시 형식 오류");
  const cached = value as Partial<CachedTransform>;
  if (cached.version !== 1 || cached.transformVersion !== TRANSFORM_VERSION || cached.hash !== expected.hash
    || cached.originalWidth !== expected.originalWidth || cached.originalHeight !== expected.originalHeight
    || !cached.original || !validSha(cached.original.sha256) || cached.original.sha256 !== expected.hash
    || typeof cached.original.key !== "string" || !cached.original.key.startsWith(`blog-images/${expected.hash}/original.`)
    || typeof cached.original.contentType !== "string" || !Array.isArray(cached.variants)
    || cached.variants.length !== expected.widths.length) {
    throw new Error("이미지 변환 캐시 검증 실패");
  }
  for (let index = 0; index < cached.variants.length; index++) {
    const variant = cached.variants[index];
    const width = expected.widths[index];
    if (!variant || variant.width !== width || !Number.isInteger(variant.height) || variant.height <= 0
      || !validSha(variant.sha256) || variant.contentType !== "image/webp"
      || variant.key !== `blog-images/${expected.hash}/${TRANSFORM_VERSION}/w${width}.webp`) {
      throw new Error("이미지 변환 캐시 검증 실패");
    }
  }
  return cached as CachedTransform;
}

function loadLocalTransform(
  cacheRoot: string,
  downloaded: DownloadedImage,
  expected: { hash: string; originalWidth: number; originalHeight: number; widths: number[] },
): Awaited<ReturnType<typeof transformImage>> | undefined {
  const descriptorPath = cacheDescriptorPath(cacheRoot, expected.hash);
  if (!existsSync(descriptorPath)) return undefined;
  let cached: CachedTransform;
  try { cached = parseCachedTransform(JSON.parse(readFileSync(descriptorPath, "utf8")), expected); }
  catch { throw new Error("이미지 변환 캐시 검증 실패"); }
  const variants = cached.variants.map((variant) => {
    const bytes = readFileSync(storedPath(cacheRoot, variant.key));
    if (sha256(bytes) !== variant.sha256) throw new Error("이미지 변환 캐시 검증 실패");
    return { ...variant, bytes };
  });
  return {
    hash: cached.hash,
    original: { ...cached.original, bytes: downloaded.bytes },
    variants,
    originalWidth: cached.originalWidth,
    originalHeight: cached.originalHeight,
  };
}

function saveLocalTransform(
  cacheRoot: string,
  transformed: Awaited<ReturnType<typeof transformImage>>,
): void {
  for (const image of [transformed.original, ...transformed.variants]) storeLocal(cacheRoot, image);
  const cached: CachedTransform = {
    version: 1,
    transformVersion: TRANSFORM_VERSION,
    hash: transformed.hash,
    original: {
      key: transformed.original.key,
      contentType: transformed.original.contentType,
      sha256: transformed.original.sha256,
    },
    variants: transformed.variants.map(({ bytes: _bytes, ...variant }) => variant),
    originalWidth: transformed.originalWidth,
    originalHeight: transformed.originalHeight,
  };
  const descriptorPath = cacheDescriptorPath(cacheRoot, transformed.hash);
  mkdirSync(path.dirname(descriptorPath), { recursive: true });
  writeFileSync(descriptorPath, JSON.stringify(cached, null, 2) + "\n");
}

async function transformImage(downloaded: DownloadedImage, cacheRoot?: string): Promise<{
  hash: string;
  original: StoredImage;
  variants: Array<StoredImage & { width: number; height: number }>;
  originalWidth: number;
  originalHeight: number;
}> {
  const started = Date.now();
  const hash = sha256(downloaded.bytes);
  const input = sharp(downloaded.bytes, { animated: true, limitInputPixels: MAX_TOTAL_PIXELS, sequentialRead: true });
  const metadata = await input.metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error("이미지 메타데이터가 없습니다");
  const pages = metadata.pages ?? 1;
  const transformBudgetMs = pages > 1 ? MAX_ANIMATED_TRANSFORM_MS : MAX_TRANSFORM_MS;
  const frameHeight = metadata.pageHeight ?? Math.floor(metadata.height / pages);
  assertImageResourceLimits(metadata.width, frameHeight, pages);
  const originalSize = orientedSize(metadata.width, frameHeight, metadata.orientation);
  const extension = originalExtension(metadata.format, downloaded.contentType);
  const original: StoredImage = {
    bytes: downloaded.bytes,
    key: `blog-images/${hash}/original.${extension}`,
    contentType: downloaded.contentType,
    sha256: hash,
  };
  const targetWidths = [...new Set<number>(WIDTHS.map((width) => Math.min(width, originalSize.width)))]
    .sort((a, b) => a - b);
  const cached = cacheRoot && loadLocalTransform(cacheRoot, downloaded, {
    hash, originalWidth: originalSize.width, originalHeight: originalSize.height, widths: targetWidths,
  });
  if (cached) return cached;
  const variants: Array<StoredImage & { width: number; height: number }> = [];
  for (const targetWidth of targetWidths) {
    if (Date.now() - started > transformBudgetMs) throw new Error("이미지 변환 시간 제한 초과");
    const transformer = sharp(downloaded.bytes, { animated: true, limitInputPixels: MAX_TOTAL_PIXELS, sequentialRead: true })
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .timeout({ seconds: Math.max(1, Math.ceil((transformBudgetMs - (Date.now() - started)) / 1000)) });
    const bytes = await transformer.webp({
      quality: metadata.format === "jpeg" || metadata.format === "avif" ? 86 : 100,
      lossless: metadata.format === "png" || metadata.format === "gif",
      effort: 4,
      loop: metadata.loop,
      delay: metadata.delay,
    }).toBuffer();
    const output = await sharp(bytes, { animated: true }).metadata();
    if (!output.width || !output.height) throw new Error("변환 이미지 크기를 확인할 수 없습니다");
    const outputHeight = output.pageHeight ?? Math.floor(output.height / (output.pages ?? 1));
    variants.push({
      bytes,
      key: `blog-images/${hash}/${TRANSFORM_VERSION}/w${output.width}.webp`,
      contentType: "image/webp",
      sha256: sha256(bytes),
      width: output.width,
      height: outputHeight,
    });
  }
  if (Date.now() - started > transformBudgetMs) throw new Error("이미지 변환 시간 제한 초과");
  const result = { hash, original, variants, originalWidth: originalSize.width, originalHeight: originalSize.height };
  if (cacheRoot) saveLocalTransform(cacheRoot, result);
  return result;
}

function notFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { $metadata?: { httpStatusCode?: number } };
  return record.$metadata?.httpStatusCode === 404;
}

async function storeS3(
  client: Pick<S3Client, "send">, bucket: string, expectedBucketOwner: string, image: StoredImage,
): Promise<void> {
  const expectedChecksum = createHash("sha256").update(image.bytes).digest("base64");
  let exists = false;
  try {
    const head = await client.send(new HeadObjectCommand({
      Bucket: bucket, Key: image.key, ChecksumMode: ChecksumMode.ENABLED, ExpectedBucketOwner: expectedBucketOwner,
    }));
    exists = true;
    if (head.Metadata?.sha256 !== image.sha256 || head.ChecksumSHA256 !== expectedChecksum) {
      throw new Error("S3 이미지 객체 검증 실패");
    }
  } catch (error) {
    if (!notFound(error)) throw error;
  }
  if (exists) return;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: image.key,
    ExpectedBucketOwner: expectedBucketOwner,
    Body: image.bytes,
    ContentType: image.contentType,
    CacheControl: IMMUTABLE_CACHE,
    ChecksumSHA256: expectedChecksum,
    Metadata: { sha256: image.sha256 },
  }));
  const verified = await client.send(new HeadObjectCommand({
    Bucket: bucket, Key: image.key, ChecksumMode: ChecksumMode.ENABLED, ExpectedBucketOwner: expectedBucketOwner,
  }));
  if (verified.Metadata?.sha256 !== image.sha256 || verified.ChecksumSHA256 !== expectedChecksum) {
    throw new Error("S3 이미지 업로드 검증 실패");
  }
}

function storeLocal(assetRoot: string, image: StoredImage): void {
  const output = path.join(assetRoot, ...image.key.split("/"));
  mkdirSync(path.dirname(output), { recursive: true });
  if (existsSync(output)) {
    if (sha256(readFileSync(output)) !== image.sha256) throw new Error("로컬 이미지 캐시 검증 실패");
    return;
  }
  writeFileSync(output, image.bytes, { flag: "wx" });
}

function modeFromEnv(env: NodeJS.ProcessEnv): ImageAssetsMode {
  const value = env.IMAGE_ASSETS_MODE?.trim().toLowerCase() || "off";
  if (value !== "off" && value !== "local" && value !== "s3") throw new Error("IMAGE_ASSETS_MODE는 off, local, s3만 지원합니다.");
  return value;
}

type ImageStage = "download" | "transform" | "storage";

/** 원본 URL·토큰·SDK 원문 대신 제한된 실패 단계와 상태만 공개한다. */
export function imageProcessingErrorMessage(error: unknown, stage: ImageStage): string {
  const message = error instanceof Error ? error.message : "";
  const known = /^(?:이미지 (?:HTTP \d{3}|크기 제한 초과|픽셀 또는 프레임 제한 초과|변환 시간 제한 초과|리다이렉트 제한 초과|호스트 확인 실패|호스트 주소가 안전하지 않습니다|메타데이터가 없습니다|다운로드 재시도 한도 초과(?: \(HTTP \d{3}\))?)|허용되지 않은 이미지 URL|지원하지 않는 이미지 형식|S3 이미지 (?:객체|업로드) 검증 실패|로컬 이미지 캐시 검증 실패)$/.test(message);
  const label = { download: "다운로드", transform: "변환", storage: "저장" }[stage];
  const safe = stage === "transform" && /^timeout:/i.test(message)
    ? "이미지 변환 시간 제한 초과" : known ? message : `이미지 ${label} 오류`;
  const metadata = error && typeof error === "object" ? (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata : undefined;
  const status = metadata?.httpStatusCode;
  return `이미지 최적화 실패 (${label}): ${safe}${typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 ? ` (HTTP ${status})` : ""}`;
}

export function emptyImageManifest(): ImageManifest {
  return { version: 1, images: {} };
}

/** 리사이즈로 파일이 더 커진 후보는 더 선명하고 작은 파일로 대체한다. */
export function imageVariantsForDelivery<T extends { width: number; bytes: Buffer }>(variants: T[]): T[] {
  return variants.filter((variant) => !variants.some((other) =>
    other.width > variant.width && other.bytes.length <= variant.bytes.length));
}

export function createImageProcessor(options: ImageProcessorFactoryOptions): ImageProcessor | undefined {
  const env = options.env ?? globalThis.process.env;
  const mode = modeFromEnv(env);
  if (mode === "off") return undefined;
  const fetcher = options.fetcher ?? fetch;
  const resolver = options.resolver ?? ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  const assetRoot = path.join(options.workRoot, "assets");
  const cacheRoot = path.join(options.root, ".content-sync", "image-cache");
  const manifest = emptyImageManifest();
  const inFlight = new Map<string, Promise<ImageAsset>>();
  let baseUrl = "";
  let bucket = "";
  let expectedBucketOwner = "";
  let s3: Pick<S3Client, "send"> | undefined;
  if (mode === "s3") {
    bucket = env.IMAGE_S3_BUCKET?.trim() ?? "";
    baseUrl = env.IMAGE_CDN_BASE_URL?.trim() ?? "";
    const region = env.AWS_REGION?.trim() ?? "";
    expectedBucketOwner = env.IMAGE_AWS_ACCOUNT_ID?.trim() ?? "";
    let parsedBaseUrl: URL | undefined;
    try { parsedBaseUrl = new URL(baseUrl); } catch { /* 아래에서 설정 오류로 처리한다. */ }
    if (!bucket || !region || !/^\d{12}$/.test(expectedBucketOwner) || !parsedBaseUrl
      || parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.username || parsedBaseUrl.password
      || parsedBaseUrl.search || parsedBaseUrl.hash || (parsedBaseUrl.port && parsedBaseUrl.port !== "443")) {
      throw new Error("s3 이미지 모드에는 IMAGE_S3_BUCKET, IMAGE_CDN_BASE_URL, AWS_REGION, IMAGE_AWS_ACCOUNT_ID가 필요합니다.");
    }
    baseUrl = parsedBaseUrl.href.replace(/\/$/, "");
    const config = imageS3Config(env);
    s3 = options.s3Client ?? new S3Client(config);
  }

  const processImage = (source: string): Promise<ImageAsset> => {
    const existing = inFlight.get(source);
    if (existing) return existing;
    const task = (async () => {
      let stage: ImageStage = "download";
      try {
        const downloaded = await downloadImage(source, fetcher, resolver);
        stage = "transform";
        const transformed = await transformImage(downloaded, cacheRoot);
        const all = [transformed.original, ...transformed.variants];
        stage = "storage";
        if (mode === "s3") {
          for (const image of all) await storeS3(s3!, bucket, expectedBucketOwner, image);
        } else {
          for (const image of all) storeLocal(assetRoot, image);
        }
        const url = (key: string) => mode === "s3" ? publicUrl(baseUrl, key) : localUrl(key);
        const deliveryVariants = imageVariantsForDelivery(transformed.variants);
        const variants = deliveryVariants.map(({ key, width }) => ({ src: url(key), width }));
        const defaultVariant = deliveryVariants.reduce((best, variant) =>
          Math.abs(variant.width - 960) < Math.abs(best.width - 960) ? variant : best);
        const asset: ImageAsset = {
          src: url(defaultVariant.key),
          originalSrc: url(transformed.original.key),
          width: defaultVariant.width,
          height: defaultVariant.height,
          originalWidth: transformed.originalWidth,
          originalHeight: transformed.originalHeight,
          variants,
        };
        manifest.images[asset.src] = asset;
        return asset;
      } catch (error) {
        throw new Error(imageProcessingErrorMessage(error, stage));
      }
    })();
    inFlight.set(source, task);
    return task;
  };
  return { manifest, process: processImage };
}
