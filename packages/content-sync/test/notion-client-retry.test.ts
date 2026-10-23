import assert from "node:assert/strict";
import test from "node:test";
import { NotionClient } from "../src/notion-client.js";

const pageId = "11111111111111111111111111111111";
const token = "super-secret-notion-token";
const markdown = { markdown: "본문", truncated: false, unknown_block_ids: [] };

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("일시적인 fetch 예외는 기존 backoff 후 재시도해 성공한다", async () => {
  let requests = 0;
  const delays: number[] = [];
  const client = new NotionClient(
    { token, dataSourceId: pageId },
    async () => {
      requests++;
      if (requests === 1) throw new Error(`일시 오류: ${token}`);
      return json(markdown);
    },
    async (delay) => { delays.push(delay); },
  );

  assert.equal(await client.markdown(pageId), "본문");
  assert.equal(requests, 2);
  assert.deepEqual(delays, [500]);
});

test("지속적인 fetch 예외는 총 3회만 시도하고 안전한 오류로 끝낸다", async () => {
  let requests = 0;
  const delays: number[] = [];
  const client = new NotionClient(
    { token, dataSourceId: pageId },
    async () => {
      requests++;
      throw new Error(`민감한 원문 ${token}`);
    },
    async (delay) => { delays.push(delay); },
  );

  await assert.rejects(client.markdown(pageId), (error: Error) => {
    assert.equal(error.message, "Notion API 네트워크 요청 실패 또는 시간 초과");
    assert.equal(error.message.includes(token), false);
    assert.equal(error.message.includes("민감한 원문"), false);
    return true;
  });
  assert.equal(requests, 3);
  assert.deepEqual(delays, [500, 1000]);
});

test("HTTP 401은 재시도하지 않고 토큰을 노출하지 않는다", async () => {
  let requests = 0;
  const delays: number[] = [];
  const client = new NotionClient(
    { token, dataSourceId: pageId },
    async () => {
      requests++;
      return json({ message: token }, 401);
    },
    async (delay) => { delays.push(delay); },
  );

  await assert.rejects(client.markdown(pageId), (error: Error) => {
    assert.match(error.message, /Notion API HTTP 401/);
    assert.equal(error.message.includes(token), false);
    return true;
  });
  assert.equal(requests, 1);
  assert.deepEqual(delays, []);
});

test("HTTP 429는 Retry-After를 존중한 뒤 재시도한다", async () => {
  let requests = 0;
  const delays: number[] = [];
  const client = new NotionClient(
    { token, dataSourceId: pageId },
    async () => ++requests === 1
      ? json({}, 429, { "Retry-After": "2" })
      : json(markdown),
    async (delay) => { delays.push(delay); },
  );

  assert.equal(await client.markdown(pageId), "본문");
  assert.equal(requests, 2);
  assert.deepEqual(delays, [2000]);
});
