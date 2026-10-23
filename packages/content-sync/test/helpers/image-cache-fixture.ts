import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { ImageProcessor } from "../../src/image-processor.js";

export const publicAddress = async () => [{ address: "93.184.216.34" }];

export const s3Env = {
  IMAGE_ASSETS_MODE: "s3",
  IMAGE_S3_BUCKET: "images",
  IMAGE_CDN_BASE_URL: "https://cdn.example.com",
  IMAGE_AWS_ACCOUNT_ID: "123456789012",
  AWS_REGION: "ap-northeast-2",
  AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/test-images",
  VERCEL_OIDC_TOKEN: "test-token-never-sent",
};

export type IncrementalStats = {
  checked: number;
  downloaded: number;
  reused: number;
  transformed: number;
  uploaded: number;
};

export type IncrementalProcessor = ImageProcessor & {
  flush(): Promise<void>;
  readonly stats: IncrementalStats;
};

export function incremental(processor: ImageProcessor): IncrementalProcessor {
  const candidate = processor as Partial<IncrementalProcessor>;
  if (typeof candidate.flush === "function" && candidate.stats) return processor as IncrementalProcessor;
  // 구현 전 RED 단계에서도 기존 다운로드·변환 경로를 끝까지 실행해 동작 차이를 드러낸다.
  return Object.assign(processor, {
    flush: async () => {},
    stats: { checked: 0, downloaded: 0, reused: 0, transformed: 0, uploaded: 0 },
  }) as IncrementalProcessor;
}

type StoredObject = {
  bytes: Buffer;
  checksum: string;
  etag: string;
  metadata: Record<string, string>;
  contentType?: string;
  cacheControl?: string;
};

function notFound(): Error {
  return Object.assign(new Error("missing"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
}

function preconditionFailed(): Error {
  return Object.assign(new Error("precondition failed"), { name: "PreconditionFailed", $metadata: { httpStatusCode: 412 } });
}

function bytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value);
  throw new Error("fake S3가 지원하지 않는 Body입니다.");
}

export class FakeS3 {
  readonly objects = new Map<string, StoredObject>();
  readonly calls: Array<{ name: string; key?: string }> = [];

  constructor(readonly pageSize = 100) {}

  resetCalls(): void {
    this.calls.length = 0;
  }

  deleteImageObject(): string {
    const key = [...this.objects.keys()].find((value) => /\/w\d+[.]webp$/.test(value));
    if (!key) throw new Error("삭제할 변환 이미지가 없습니다.");
    this.objects.delete(key);
    return key;
  }

  tamperImageObjectSameSize(): string {
    const key = [...this.objects.keys()].find((value) => /\/w\d+[.]webp$/.test(value));
    if (!key) throw new Error("변조할 변환 이미지가 없습니다.");
    const stored = this.objects.get(key)!;
    const changed = Buffer.from(stored.bytes);
    changed[0] ^= 0xff;
    stored.bytes = changed;
    stored.etag = `"${createHash("md5").update(changed).digest("hex")}"`;
    stored.checksum = createHash("sha256").update(changed).digest("base64");
    return key;
  }

  count(name: string, kind?: "index" | "image"): number {
    return this.calls.filter((call) => call.name === name && (kind === undefined
      || (kind === "index" ? call.key?.endsWith(".json") : !call.key?.endsWith(".json")))).length;
  }

  async send(command: GetObjectCommand | ListObjectsV2Command | HeadObjectCommand | PutObjectCommand): Promise<unknown> {
    const name = command.constructor.name;
    const key = "Key" in command.input ? String(command.input.Key) : undefined;
    this.calls.push({ name, key });

    if (command instanceof GetObjectCommand) {
      const stored = this.objects.get(key!);
      if (!stored) throw notFound();
      return {
        Body: {
          transformToString: async () => stored.bytes.toString("utf8"),
          transformToByteArray: async () => new Uint8Array(stored.bytes),
        },
        ContentLength: stored.bytes.length,
        ContentType: stored.contentType,
        CacheControl: stored.cacheControl,
        ETag: stored.etag,
        Metadata: stored.metadata,
        ChecksumSHA256: stored.checksum,
      };
    }

    if (command instanceof ListObjectsV2Command) {
      const prefix = String(command.input.Prefix ?? "");
      const start = Number(command.input.ContinuationToken ?? 0);
      const keys = [...this.objects.keys()].filter((value) => value.startsWith(prefix)).sort();
      const page = keys.slice(start, start + this.pageSize);
      const next = start + page.length;
      return {
        Contents: page.map((value) => ({
          Key: value,
          Size: this.objects.get(value)!.bytes.length,
          ETag: this.objects.get(value)!.etag,
        })),
        IsTruncated: next < keys.length,
        ...(next < keys.length ? { NextContinuationToken: String(next) } : {}),
      };
    }

    if (command instanceof HeadObjectCommand) {
      const stored = this.objects.get(key!);
      if (!stored) throw notFound();
      return {
        ContentLength: stored.bytes.length,
        ContentType: stored.contentType,
        ETag: stored.etag,
        Metadata: stored.metadata,
        ChecksumSHA256: stored.checksum,
      };
    }

    const previous = this.objects.get(key!);
    if (command.input.IfNoneMatch === "*" && previous) throw preconditionFailed();
    if (command.input.IfMatch !== undefined && previous?.etag !== command.input.IfMatch) throw preconditionFailed();
    if (command.input.IfMatch !== undefined && !previous) throw preconditionFailed();
    const body = bytes(command.input.Body);
    const checksum = createHash("sha256").update(body).digest("base64");
    if (command.input.ChecksumSHA256 && command.input.ChecksumSHA256 !== checksum) {
      throw new Error("checksum mismatch");
    }
    const etag = `"${createHash("md5").update(body).digest("hex")}"`;
    this.objects.set(key!, {
      bytes: body,
      checksum,
      etag,
      metadata: Object.fromEntries(Object.entries(command.input.Metadata ?? {}).map(([name, value]) => [name, String(value)])),
      contentType: command.input.ContentType,
      cacheControl: command.input.CacheControl,
    });
    return { ETag: etag, ChecksumSHA256: checksum };
  }
}

export type RemoteRecord = {
  bytes: Buffer;
  etag?: string;
  lastModified?: string;
  redirect?: string;
  conditionalStatus?: 400 | 412;
  error?: Error;
};

export class FakeRemote {
  readonly records = new Map<string, RemoteRecord>();
  readonly calls: Array<{
    url: string;
    method: string;
    ifNoneMatch: string | null;
    ifModifiedSince: string | null;
    status: number;
  }> = [];

  set(url: string, record: RemoteRecord): void {
    this.records.set(url, record);
  }

  fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    const record = this.records.get(input);
    if (!record) throw new Error(`fake remote에 없는 URL: ${input}`);
    const headers = new Headers(init?.headers);
    const method = init?.method ?? "GET";
    const ifNoneMatch = headers.get("if-none-match");
    const ifModifiedSince = headers.get("if-modified-since");
    if (record.error) {
      this.calls.push({ url: input, method, ifNoneMatch, ifModifiedSince, status: 0 });
      throw record.error;
    }
    if (record.redirect) {
      this.calls.push({ url: input, method, ifNoneMatch, ifModifiedSince, status: 302 });
      return new Response(null, { status: 302, headers: { location: record.redirect } });
    }
    const responseHeaders = new Headers({
      "content-type": "image/png",
      "content-length": String(record.bytes.length),
      ...(record.etag ? { etag: record.etag } : {}),
      ...(record.lastModified ? { "last-modified": record.lastModified } : {}),
    });
    if (record.conditionalStatus && (ifNoneMatch || ifModifiedSince)) {
      this.calls.push({ url: input, method, ifNoneMatch, ifModifiedSince, status: record.conditionalStatus });
      return new Response(null, { status: record.conditionalStatus, headers: responseHeaders });
    }
    const unchanged = (record.etag && ifNoneMatch === record.etag)
      || (!record.etag && record.lastModified && ifModifiedSince === record.lastModified);
    const status = unchanged ? 304 : 200;
    this.calls.push({ url: input, method, ifNoneMatch, ifModifiedSince, status });
    return new Response(unchanged ? null : record.bytes, { status, headers: responseHeaders });
  };
}
