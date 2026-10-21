import assert from "node:assert/strict";
import test from "node:test";
import { decodeRouteSegment } from "../src/lib/route-segment.ts";

test("글·태그·시리즈의 한글 주소를 한 번 디코딩하고 NFC로 통일한다", () => {
  for (const value of ["글또-삶의-지도", "회고", "React-캘린더", "설계-일지"]) {
    assert.equal(decodeRouteSegment(value), value);
    assert.equal(decodeRouteSegment(encodeURIComponent(value)), value);
    assert.equal(decodeRouteSegment(value.normalize("NFD")), value);
  }
  assert.equal(decodeRouteSegment("AWS-Lambda-API-Gateway"), "AWS-Lambda-API-Gateway");
});

test("깨진 인코딩이나 단일 조각이 아닌 주소를 조회 키로 사용하지 않는다", () => {
  for (const value of ["%", "%ED%", "a%2Fb", "a%5Cb", "a%252Fb", "..", "a b", ""]) {
    assert.equal(decodeRouteSegment(value), undefined, value);
  }
});
