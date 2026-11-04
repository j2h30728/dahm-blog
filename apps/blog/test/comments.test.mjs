import assert from "node:assert/strict";
import test from "node:test";
import { getGiscusConfig } from "../src/lib/comments.ts";

test("추가 환경변수 없이 실제 블로그 댓글 카테고리에 연결한다", () => {
  assert.deepEqual(getGiscusConfig({}), {
    repo: "j2h30728/dahm-blog",
    repoId: "R_kgDOTChpKA",
    category: "Announcements",
    categoryId: "DIC_kwDOTChpKM4DKVhX",
  });
});

test("운영 옵션으로 외부 댓글을 명시적으로 비활성화한다", () => {
  for (const value of ["false", " FALSE ", "\nFalse\n"]) {
    assert.equal(getGiscusConfig({ GISCUS_ENABLED: value }), null);
  }
});

test("활성화 옵션과 빈 옵션은 같은 댓글 저장소를 유지한다", () => {
  assert.deepEqual(getGiscusConfig({ GISCUS_ENABLED: "true" }), getGiscusConfig({}));
  assert.deepEqual(getGiscusConfig({ GISCUS_ENABLED: " " }), getGiscusConfig({}));
});
