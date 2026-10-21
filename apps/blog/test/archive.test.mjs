import assert from "node:assert/strict";
import test from "node:test";
import { filterArchivePosts, getArchiveCategory, getArchiveHref } from "../src/lib/archive.ts";

const tech = {
  slug: "react-note", category: "tech", title: "React의 상태", description: "소유권을 고민한 기록",
  excerpt: "서버 캐시", topic: "frontend", tags: ["React"], series: "설계 일지",
};
const life = {
  slug: "weekend-note", category: "life", title: "주말의 산책", description: "걷다가 든 생각",
  excerpt: "책과 커피", topic: "회고", tags: ["일상"],
};
const legacy = { ...tech, slug: "old-post", category: undefined };
const posts = [tech, life, legacy];

test("처음 방문하거나 알 수 없는 분류 주소이면 기술 목록을 선택한다", () => {
  for (const value of [null, undefined, "", "all", "unknown", "tech"]) {
    assert.equal(getArchiveCategory(value), "tech");
  }
  assert.equal(getArchiveCategory("life"), "life");
});

test("기술과 일상은 분리하고 분류 없는 기존 글은 기술로 유지한다", () => {
  assert.deepEqual(filterArchivePosts(posts, "tech").map(post => post.slug), ["react-note", "old-post"]);
  assert.deepEqual(filterArchivePosts(posts, "life").map(post => post.slug), ["weekend-note"]);
  assert.deepEqual(filterArchivePosts([], "life"), []);
});

test("검색은 현재 분류 안에서 제목·설명·본문 요약·주제·시리즈·태그를 찾는다", () => {
  for (const query of ["react", " 소유권 ", "캐시", "FRONTEND", "설계 일지"]) {
    assert.deepEqual(filterArchivePosts([tech, life], "tech", query).map(post => post.slug), ["react-note"]);
  }
  assert.deepEqual(filterArchivePosts(posts, "life", "React"), []);
  assert.deepEqual(filterArchivePosts(posts, "tech", "산책"), []);
  assert.deepEqual(filterArchivePosts(posts, "life", "커피").map(post => post.slug), ["weekend-note"]);
});

test("분류 링크는 검색어와 다른 매개변수를 보존하고 기술 기본 주소를 정규화한다", () => {
  const lifeUrl = new URL(getArchiveHref("q=React&utm_source=rss", { category: "life" }), "https://dahm.test");
  assert.equal(lifeUrl.pathname, "/posts/");
  assert.equal(lifeUrl.searchParams.get("q"), "React");
  assert.equal(lifeUrl.searchParams.get("category"), "life");
  assert.equal(lifeUrl.searchParams.get("utm_source"), "rss");
  assert.equal(getArchiveHref("category=life", { category: "tech" }), "/posts/");
});

test("검색 제출과 해제는 일상 분류를 유지하고 특수문자를 안전하게 인코딩한다", () => {
  const url = new URL(getArchiveHref("category=life", { q: " 산책 & 커피 " }), "https://dahm.test");
  assert.equal(url.searchParams.get("q"), "산책 & 커피");
  assert.equal(url.searchParams.get("category"), "life");
  assert.equal(getArchiveHref(url.search, { q: "" }), "/posts/?category=life");
  assert.equal(getArchiveHref("q=old", { q: "   " }), "/posts/");
});
