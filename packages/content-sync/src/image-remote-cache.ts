import { createHash } from "node:crypto";
import {
  ChecksumMode,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

const MAX_INDEX_BYTES = 8 * 1024 * 1024;
const MAX_INDEX_ENTRIES = 10_000;
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const MAX_FRAME_PIXELS = 24_000_000;
const MAX_INVENTORY_PAGES = 100;
const MAX_CAS_ATTEMPTS = 3;
const INDEX_CACHE_CONTROL = "private, no-store";
const READ_WARNING = "S3 이미지 원격 캐시를 읽지 못해 전체 처리를 계속합니다.";
const WRITE_WARNING = "S3 이미지 원격 캐시를 저장하지 못했지만 이미지 처리는 완료했습니다.";
const ACCESS_ERROR = "S3 이미지 원격 캐시 접근 권한을 확인하세요.";

export interface ImageCacheObject {
  key: string;
  sha256: string;
  byteLength: number;
  contentType: string;
  etag: string;
}

export interface RemoteImageDescriptor {
  hash: string;
  original: ImageCacheObject;
  variants: Array<ImageCacheObject & { width: number; height: number }>;
  originalWidth: number;
  originalHeight: number;
}

export interface RemoteSourceRecord {
  hash: string;
  validatorUrlHash: string;
  etag?: string;
  lastModified?: string;
}

interface RemoteIndex {
  version: 1;
  policyVersion: string;
  sources: Record<string, RemoteSourceRecord>;
  images: Record<string, RemoteImageDescriptor>;
}

interface ReadIndexResult {
  index: RemoteIndex;
  etag: string;
  invalid: boolean;
}

interface CacheOptions {
  client: Pick<S3Client, "send">;
  bucket: string;
  expectedBucketOwner: string;
  transformVersion: string;
  policyVersion: string;
  widths: readonly number[];
  warn?: (message: string) => void;
}

export interface RemoteImageCache {
  initialize(): Promise<void>;
  source(identityHash: string): RemoteSourceRecord | undefined;
  image(contentHash: string): RemoteImageDescriptor | undefined;
  remember(identityHash: string, source: RemoteSourceRecord, image: RemoteImageDescriptor): void;
  flush(): Promise<void>;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("base64");
}

function statusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode;
  return typeof status === "number" ? status : undefined;
}

function emptyIndex(policyVersion: string): RemoteIndex {
  return { version: 1, policyVersion, sources: {}, images: {} };
}

function cloneIndex(index: RemoteIndex): RemoteIndex {
  return {
    version: 1,
    policyVersion: index.policyVersion,
    sources: { ...index.sources },
    images: { ...index.images },
  };
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validOpaque(value: unknown, max = 1024): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function validLastModified(value: unknown): value is string {
  return validOpaque(value, 128) && Number.isFinite(Date.parse(value));
}

function validHttpEtag(value: unknown): value is string {
  return validOpaque(value) && /^(?:W\/)?"[^"\u0000-\u001f\u007f]*"$/.test(value);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function originalExtension(contentType: string): string | undefined {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/tiff": "tiff",
    "image/heif": "heif",
  } as Record<string, string>)[contentType];
}

function parseCacheObject(value: unknown): ImageCacheObject | undefined {
  const item = record(value);
  if (!item || typeof item.key !== "string" || !validHash(item.sha256)
    || !validPositiveInteger(item.byteLength) || typeof item.contentType !== "string"
    || !validOpaque(item.etag)) return undefined;
  return {
    key: item.key,
    sha256: item.sha256,
    byteLength: item.byteLength,
    contentType: item.contentType,
    etag: item.etag,
  };
}

function parseImage(
  value: unknown,
  mapHash: string,
  transformVersion: string,
  widths: readonly number[],
): RemoteImageDescriptor | undefined {
  const item = record(value);
  if (!item || item.hash !== mapHash || !validHash(item.hash)
    || !validPositiveInteger(item.originalWidth) || !validPositiveInteger(item.originalHeight)
    || item.originalWidth * item.originalHeight > MAX_FRAME_PIXELS || !Array.isArray(item.variants)) return undefined;
  const original = parseCacheObject(item.original);
  if (!original || original.sha256 !== item.hash || original.byteLength > MAX_ORIGINAL_BYTES) return undefined;
  const extension = originalExtension(original.contentType);
  if (!extension || original.key !== `blog-images/${item.hash}/original.${extension}`) return undefined;
  const candidates = new Set(widths.map((width) => Math.min(width, item.originalWidth as number)));
  const variants: RemoteImageDescriptor["variants"] = [];
  let previousWidth = 0;
  for (const value of item.variants) {
    const variantValue = record(value);
    const variant = parseCacheObject(value);
    if (!variantValue || !variant || !validPositiveInteger(variantValue.width)
      || !validPositiveInteger(variantValue.height) || variantValue.width * variantValue.height > MAX_FRAME_PIXELS
      || variant.contentType !== "image/webp" || variant.byteLength >= original.byteLength
      || !candidates.has(variantValue.width) || variantValue.width <= previousWidth
      || variant.key !== `blog-images/${item.hash}/${transformVersion}/w${variantValue.width}.webp`) return undefined;
    previousWidth = variantValue.width;
    variants.push({ ...variant, width: variantValue.width, height: variantValue.height });
  }
  if (variants.some((variant) => variants.some((other) =>
    other.width > variant.width && other.byteLength <= variant.byteLength))) return undefined;
  return {
    hash: item.hash,
    original,
    variants,
    originalWidth: item.originalWidth,
    originalHeight: item.originalHeight,
  };
}

function parseSource(value: unknown): RemoteSourceRecord | undefined {
  const item = record(value);
  if (!item || !validHash(item.hash) || !validHash(item.validatorUrlHash)
    || (item.etag !== undefined && !validHttpEtag(item.etag))
    || (item.lastModified !== undefined && !validLastModified(item.lastModified))) return undefined;
  return {
    hash: item.hash,
    validatorUrlHash: item.validatorUrlHash,
    ...(item.etag === undefined ? {} : { etag: item.etag }),
    ...(item.lastModified === undefined ? {} : { lastModified: item.lastModified }),
  };
}

function parseIndex(
  value: unknown,
  policyVersion: string,
  transformVersion: string,
  widths: readonly number[],
): RemoteIndex | undefined {
  const item = record(value);
  const sourceValues = record(item?.sources);
  const imageValues = record(item?.images);
  if (!item || item.version !== 1 || item.policyVersion !== policyVersion || !sourceValues || !imageValues
    || Object.keys(sourceValues).length > MAX_INDEX_ENTRIES || Object.keys(imageValues).length > MAX_INDEX_ENTRIES) return undefined;
  const images: Record<string, RemoteImageDescriptor> = {};
  for (const [hash, imageValue] of Object.entries(imageValues)) {
    const image = validHash(hash) && parseImage(imageValue, hash, transformVersion, widths);
    if (image) images[hash] = image;
  }
  const sources: Record<string, RemoteSourceRecord> = {};
  for (const [identity, sourceValue] of Object.entries(sourceValues)) {
    const source = validHash(identity) && parseSource(sourceValue);
    if (source && images[source.hash]) sources[identity] = source;
  }
  return { version: 1, policyVersion, sources, images };
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeIndexes(base: RemoteIndex, local: RemoteIndex, latest: RemoteIndex): RemoteIndex | undefined {
  const images = { ...latest.images };
  for (const [hash, localImage] of Object.entries(local.images)) {
    const baseImage = base.images[hash];
    if (same(localImage, baseImage)) continue;
    const latestImage = latest.images[hash];
    if (latestImage && !same(latestImage, baseImage) && !same(latestImage, localImage)) return undefined;
    images[hash] = localImage;
  }
  const sources = { ...latest.sources };
  const identities = new Set([...Object.keys(base.sources), ...Object.keys(local.sources), ...Object.keys(latest.sources)]);
  for (const identity of identities) {
    const baseSource = base.sources[identity];
    const localSource = local.sources[identity];
    const latestSource = latest.sources[identity];
    const localChanged = !same(localSource, baseSource);
    const latestChanged = !same(latestSource, baseSource);
    if (localChanged && latestChanged && !same(localSource, latestSource)) {
      delete sources[identity];
    } else if (localChanged) {
      if (localSource) sources[identity] = localSource;
      else delete sources[identity];
    }
  }
  for (const [identity, source] of Object.entries(sources)) {
    if (!images[source.hash]) delete sources[identity];
  }
  return { version: 1, policyVersion: local.policyVersion, sources, images };
}

export function createRemoteImageCache(options: CacheOptions): RemoteImageCache {
  const { client, bucket, expectedBucketOwner, transformVersion, policyVersion } = options;
  const widths = [...new Set(options.widths)].sort((a, b) => a - b);
  if (!bucket || !/^\d{12}$/.test(expectedBucketOwner)
    || !/^[A-Za-z0-9._-]{1,160}$/.test(transformVersion)
    || !/^[A-Za-z0-9._-]{1,160}$/.test(policyVersion)
    || widths.length === 0 || widths.some((width) => !validPositiveInteger(width))) {
    throw new Error("이미지 원격 캐시 설정 오류");
  }
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const key = `blog-images/_cache/${policyVersion}/source-index.json`;
  let initialized: Promise<void> | undefined;
  let base = emptyIndex(policyVersion);
  let working = emptyIndex(policyVersion);
  let baseEtag: string | undefined;
  let dirty = false;
  let writeDisabled = false;

  const readIndex = async (): Promise<ReadIndexResult> => {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ExpectedBucketOwner: expectedBucketOwner,
      ChecksumMode: ChecksumMode.ENABLED,
    }));
    const output = response as unknown as {
      Body?: { transformToString?: () => Promise<string>; destroy?: () => void };
      ContentLength?: number;
      ETag?: string;
      ChecksumSHA256?: string;
    };
    if (!validOpaque(output.ETag)) throw new Error("invalid cache index response");
    if (output.ContentLength !== undefined && output.ContentLength > MAX_INDEX_BYTES) {
      output.Body?.destroy?.();
      return { index: emptyIndex(policyVersion), etag: output.ETag, invalid: true };
    }
    if (!output.Body?.transformToString) return { index: emptyIndex(policyVersion), etag: output.ETag, invalid: true };
    const text = await output.Body.transformToString();
    const bytes = Buffer.from(text);
    if (bytes.length > MAX_INDEX_BYTES || (output.ChecksumSHA256 && output.ChecksumSHA256 !== checksum(bytes))) {
      return { index: emptyIndex(policyVersion), etag: output.ETag, invalid: true };
    }
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { return { index: emptyIndex(policyVersion), etag: output.ETag, invalid: true }; }
    const parsed = parseIndex(value, policyVersion, transformVersion, widths);
    return parsed
      ? { index: parsed, etag: output.ETag, invalid: false }
      : { index: emptyIndex(policyVersion), etag: output.ETag, invalid: true };
  };

  const initialize = async (): Promise<void> => {
    let loaded: ReadIndexResult;
    try {
      loaded = await readIndex();
    } catch (error) {
      const status = statusCode(error);
      if (status === 403) throw new Error(ACCESS_ERROR);
      if (status === 404) {
        base = emptyIndex(policyVersion);
        working = cloneIndex(base);
        return;
      }
      warn(READ_WARNING);
      base = emptyIndex(policyVersion);
      working = cloneIndex(base);
      return;
    }
    baseEtag = loaded.etag;
    base = cloneIndex(loaded.index);
    working = cloneIndex(loaded.index);
    if (loaded.invalid) {
      warn(READ_WARNING);
      return;
    }
    if (Object.keys(loaded.index.images).length === 0) return;

    const inventory = new Map<string, { size: number; etag: string }>();
    const tokens = new Set<string>();
    let token: string | undefined;
    try {
      for (let page = 0; page < MAX_INVENTORY_PAGES; page++) {
        const response = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: "blog-images/",
          ExpectedBucketOwner: expectedBucketOwner,
          ...(token ? { ContinuationToken: token } : {}),
        })) as unknown as {
          Contents?: Array<{ Key?: string; Size?: number; ETag?: string }>;
          IsTruncated?: boolean;
          NextContinuationToken?: string;
        };
        for (const item of response.Contents ?? []) {
          if (typeof item.Key === "string" && validPositiveInteger(item.Size) && validOpaque(item.ETag)) {
            inventory.set(item.Key, { size: item.Size, etag: item.ETag });
          }
        }
        if (!response.IsTruncated) {
          token = undefined;
          break;
        }
        const next = response.NextContinuationToken;
        if (!next || tokens.has(next)) throw new Error("invalid inventory pagination");
        tokens.add(next);
        token = next;
        if (page + 1 === MAX_INVENTORY_PAGES) throw new Error("inventory pagination limit");
      }
    } catch (error) {
      if (statusCode(error) === 403) throw new Error(ACCESS_ERROR);
      warn(READ_WARNING);
      writeDisabled = true;
      working = emptyIndex(policyVersion);
      return;
    }
    const images: Record<string, RemoteImageDescriptor> = {};
    for (const [hash, image] of Object.entries(loaded.index.images)) {
      const objects = [image.original, ...image.variants];
      if (objects.every((object) => {
        const found = inventory.get(object.key);
        return found?.size === object.byteLength && found.etag === object.etag;
      })) images[hash] = image;
    }
    const sources = Object.fromEntries(Object.entries(loaded.index.sources)
      .filter(([, source]) => images[source.hash]));
    base = { version: 1, policyVersion, sources, images };
    working = cloneIndex(base);
  };

  const cache: RemoteImageCache = {
    initialize: () => initialized ??= initialize(),
    source: (identityHash) => validHash(identityHash) ? working.sources[identityHash] : undefined,
    image: (contentHash) => validHash(contentHash) ? working.images[contentHash] : undefined,
    remember(identityHash, sourceValue, imageValue) {
      if (!validHash(identityHash) || sourceValue.hash !== imageValue.hash) return;
      const parsedImage = parseImage(imageValue, imageValue.hash, transformVersion, widths);
      const parsedSource = parseSource(sourceValue);
      if (!parsedImage || !parsedSource) return;
      const existing = working.images[parsedImage.hash];
      if (existing && !same(existing, parsedImage)) {
        warn(WRITE_WARNING);
        return;
      }
      if (same(existing, parsedImage) && same(working.sources[identityHash], parsedSource)) return;
      working.images[parsedImage.hash] = parsedImage;
      working.sources[identityHash] = parsedSource;
      dirty = true;
    },
    async flush() {
      await cache.initialize();
      if (!dirty) return;
      if (writeDisabled) return;
      let attemptBase = cloneIndex(base);
      let attemptIndex = cloneIndex(working);
      let attemptEtag = baseEtag;
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
        const body = Buffer.from(JSON.stringify(attemptIndex));
        if (Object.keys(attemptIndex.sources).length > MAX_INDEX_ENTRIES
          || Object.keys(attemptIndex.images).length > MAX_INDEX_ENTRIES || body.length > MAX_INDEX_BYTES) {
          warn(WRITE_WARNING);
          return;
        }
        try {
          const response = await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ExpectedBucketOwner: expectedBucketOwner,
            Body: body,
            ContentType: "application/json",
            CacheControl: INDEX_CACHE_CONTROL,
            ChecksumSHA256: checksum(body),
            ...(attemptEtag ? { IfMatch: attemptEtag } : { IfNoneMatch: "*" }),
          })) as unknown as { ETag?: string };
          base = cloneIndex(attemptIndex);
          working = cloneIndex(attemptIndex);
          baseEtag = validOpaque(response.ETag) ? response.ETag : undefined;
          dirty = false;
          return;
        } catch (error) {
          const status = statusCode(error);
          if ((status !== 409 && status !== 412) || attempt + 1 >= MAX_CAS_ATTEMPTS) {
            warn(WRITE_WARNING);
            return;
          }
          let latest: ReadIndexResult;
          try {
            latest = await readIndex();
          } catch (readError) {
            if (statusCode(readError) === 404) {
              latest = { index: emptyIndex(policyVersion), etag: "", invalid: false };
            }
            else {
              warn(WRITE_WARNING);
              return;
            }
          }
          const merged = mergeIndexes(attemptBase, attemptIndex, latest.index);
          if (!merged) {
            warn(WRITE_WARNING);
            return;
          }
          attemptBase = latest.index;
          attemptIndex = merged;
          attemptEtag = latest.etag || undefined;
        }
      }
    },
  };
  return cache;
}
