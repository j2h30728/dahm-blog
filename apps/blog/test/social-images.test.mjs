import assert from "node:assert/strict";
import test from "node:test";
import { getPostSocialImagePath, getSocialImage } from "../src/lib/site.ts";
import { renderSocialImage, socialImageElement } from "../scripts/lib/social-image.mjs";

test("글 이미지는 한글과 특수문자 slug를 URL 인코딩하고 실제 제목을 alt로 제공한다", () => {
  const post = { slug: "한글 & 제목", title: '실제 <제목> & "인용"' };
  assert.equal(getPostSocialImagePath(post.slug), "/og/posts/%ED%95%9C%EA%B8%80%20%26%20%EC%A0%9C%EB%AA%A9.png");
  const before = process.env.PUBLIC_SITE_URL;
  try {
    process.env.PUBLIC_SITE_URL = "https://dahm-lee.com";
    const image = getSocialImage(post);
    assert.equal(image.url, `https://dahm-lee.com${getPostSocialImagePath(post.slug)}`);
    assert.equal(image.alt, post.title);
    assert.equal(getSocialImage().url, "https://dahm-lee.com/og/dahm.png");
  } finally {
    if (before === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = before;
  }
});

test("이미지 경로는 생성 디렉터리를 벗어나는 slug를 거부한다", () => {
  for (const slug of ["", ".", "..", "../private", "foo/bar", "foo\\bar", "foo\u0000bar"]) {
    assert.throws(() => getPostSocialImagePath(slug), /Invalid social image slug/);
  }
});

test("글 제목은 전체 문자열을 왼쪽 정렬하고 긴 제목에는 글자 크기를 줄인다", () => {
  const title = 'OpenAPI <spec> & "프론트엔드"';
  const tree = socialImageElement({ title, hostname: "dahm-lee.com" });
  const heading = tree.props.children[1].props.children;
  assert.equal(heading.props.children, title);
  assert.equal(heading.props.style.textAlign, "left");
  const long = socialImageElement({ title: "긴 제목의 줄바꿈을 확인합니다 ".repeat(10), hostname: "dahm-lee.com" });
  assert.ok(long.props.children[1].props.children.props.style.fontSize < heading.props.style.fontSize);
  const home = socialImageElement({ hostname: "dahm-lee.com" });
  assert.equal(home.props.children[1].props.children.props.children, "dahm-lee");
  assert.equal(tree.props.children[0].props.children, "dahm-lee");
  assert.doesNotMatch(JSON.stringify(home), /프론트엔드 개발과 일상의 기록/);
  assert.equal(home.props.children[2].props.style.borderTop, "1px solid #e2e2e2");
});

test("로컬 폰트로 특수문자·긴 한글 제목 PNG를 생성한다", async () => {
  for (const title of [undefined, '실제 <제목> & "인용"', "긴 제목의 줄바꿈을 확인합니다 ".repeat(10)]) {
    const png = await renderSocialImage({ title, hostname: "dahm-lee.com" });
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
  }
});
