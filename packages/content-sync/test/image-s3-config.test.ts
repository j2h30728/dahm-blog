import assert from "node:assert/strict";
import { test } from "node:test";
import { imageS3Config } from "../src/image-s3-config.js";
import { createImageProcessor } from "../src/image-processor.js";

const oidcEnv = {
  AWS_REGION: "ap-northeast-2",
  IMAGE_AWS_ACCOUNT_ID: "123456789012",
  AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/dahm-blog-image-uploader",
  VERCEL_OIDC_TOKEN: "test-token-never-sent",
};

test("S3 설정은 장기 키가 있어도 명시적인 Vercel OIDC provider를 선택한다", async () => {
  const identity = { accessKeyId: "temporary-test", secretAccessKey: "temporary-test", sessionToken: "temporary-session" };
  const provider = async () => identity;
  let input: unknown;
  const config = imageS3Config({
    ...oidcEnv, AWS_ACCESS_KEY_ID: "ignored-static-key", AWS_SECRET_ACCESS_KEY: "ignored-static-secret",
    AWS_PROFILE: "ignored-profile",
  }, (options) => { input = options; return provider; });
  assert.equal(config.region, "ap-northeast-2");
  assert.deepEqual(input, { roleArn: oidcEnv.AWS_ROLE_ARN });
  assert.equal(config.credentials, provider);
  assert.ok(typeof config.credentials === "function");
  assert.deepEqual(await config.credentials(), identity);
  assert.ok(!JSON.stringify(input).includes(oidcEnv.VERCEL_OIDC_TOKEN));
});

test("역할 누락·다른 계정·사용자 ARN·잘못된 ARN을 provider 호출 전에 거부한다", () => {
  let calls = 0;
  const factory = () => { calls++; return async () => ({ accessKeyId: "unused", secretAccessKey: "unused" }); };
  for (const role of [undefined, "", "arn:aws:iam::999999999999:role/other", "arn:aws:iam::123456789012:user/name", "not-an-arn"]) {
    assert.throws(() => imageS3Config({ ...oidcEnv, AWS_ROLE_ARN: role }, factory), /AWS_ROLE_ARN/);
  }
  assert.equal(calls, 0);
});

test("OIDC 토큰이 없으면 정적 키나 파일 이름만으로 인증을 대신하지 않는다", () => {
  let calls = 0;
  const factory = () => { calls++; return async () => ({ accessKeyId: "unused", secretAccessKey: "unused" }); };
  for (const token of [undefined, "", "  "]) {
    assert.throws(() => imageS3Config({
      ...oidcEnv, VERCEL_OIDC_TOKEN: token, VERCEL_OIDC_TOKEN_FILE: "/unused-token-file",
      AWS_ACCESS_KEY_ID: "ignored-static-key", AWS_SECRET_ACCESS_KEY: "ignored-static-secret",
    }, factory), /Vercel 빌드.*VERCEL_OIDC_TOKEN/);
  }
  assert.equal(calls, 0);
});

test("지역과 버킷 소유 계정 설정을 검증한다", () => {
  assert.throws(() => imageS3Config({ ...oidcEnv, AWS_REGION: "" }), /AWS_REGION/);
  assert.throws(() => imageS3Config({ ...oidcEnv, IMAGE_AWS_ACCOUNT_ID: "invalid" }), /IMAGE_AWS_ACCOUNT_ID/);
});

test("OIDC 역할 수임 실패를 정적 자격증명으로 우회하지 않는다", async () => {
  const error = new Error("test-role-denied");
  const config = imageS3Config({ ...oidcEnv, AWS_ACCESS_KEY_ID: "ignored-static-key", AWS_SECRET_ACCESS_KEY: "ignored-static-secret" },
    () => async () => { throw error; });
  assert.ok(typeof config.credentials === "function");
  await assert.rejects(config.credentials(), (actual) => actual === error);
});

test("s3 모드의 누락된 OIDC 설정은 다운로드 전에 실패하고 local/off에는 필요 없다", () => {
  const env = { IMAGE_ASSETS_MODE: "s3", IMAGE_S3_BUCKET: "images", IMAGE_CDN_BASE_URL: "https://cdn.example.com", ...oidcEnv, VERCEL_OIDC_TOKEN: "" };
  let requests = 0;
  assert.throws(() => createImageProcessor({ root: "/unused", workRoot: "/unused", env,
    fetcher: async () => { requests++; throw new Error("must-not-fetch"); },
  }), /VERCEL_OIDC_TOKEN/);
  assert.equal(requests, 0);
  assert.equal(createImageProcessor({ root: "/unused", workRoot: "/unused", env: {} }), undefined);
  assert.ok(createImageProcessor({ root: "/unused", workRoot: "/unused", env: { IMAGE_ASSETS_MODE: "local" } }));
});
