---
title: "Obsidian 기능 쇼케이스"
slug: "obsidian-feature-showcase"
description: "웹에서 지원하는 Obsidian 작성 문법을 한 글에서 확인하는 샘플."
date: "2026-06-25"
updated: "2026-06-25"
tags:
  - obsidian
  - showcase
  - publishing
aliases:
  - "Obsidian Showcase"
  - "기능 데모"
cssclasses:
  - feature-showcase
series: "Building The Blog"
seriesOrder: 3
published: true
rating: 5
featured: true
reviewed: "2026-06-25"
---

%% 이 문장은 공개 글에서 보이면 안 됩니다. %%

## 한 번에 보는 작성 문법

Obsidian에서 쓰던 문장 안 하이라이트는 ==이렇게 표시됩니다==. 인라인 태그도 함께 수집됩니다. #obsidian/showcase

같은 글 안의 섹션으로 이동하려면 [[#콜아웃과 태스크|콜아웃 섹션]]으로 연결할 수 있습니다.
같은 문단의 블록도 [[^showcase-block|블록 링크]]로 연결됩니다. ^showcase-block

다른 공개 노트는 별칭과 마크다운 링크 모두로 연결됩니다.

- [[openapi-generator-boundaries|OpenAPI Generator 글]]
- [API 타입 섹션](openapi-generator-boundaries.md#API%20타입을%20옮겨%20적는%20비용)
- [[openapi-generator-boundaries#CLI로 만들기|CLI 섹션]]

## 콜아웃과 태스크

> [!tip]+ 열려 있는 팁
> 접힌 상태를 포함한 Obsidian callout 문법을 웹에서 읽을 수 있는 형태로 보여줍니다.

> [!warning]- 닫힌 경고
> 접힌 상태 표시는 정적 읽기 화면에서 상태 라벨로 드러납니다.

- [ ] 아직 하지 않은 항목
- [x] 완료한 항목
- [?] 확인이 필요한 항목
- [!] 주의가 필요한 항목

## 공개 노트 임베드

아래는 공개 노트를 안전한 링크 카드 형태로 임베드한 예시입니다.

![[openapi-generator-boundaries|OpenAPI Generator embed]]

## 이미지와 미디어

이미지는 Obsidian 크기 alias를 그대로 사용합니다.

![[../assets/pipeline.svg|Pipeline diagram|720x360]]

![[../assets/pipeline-thumb.png|Pipeline thumbnail|320]]

오디오, 영상, PDF도 공개 assets일 때 읽기 전용으로 임베드됩니다.

![[../assets/showcase-tone.wav|Short tone]]

![[../assets/showcase-video.mp4|Showcase video|640x360]]

![[../assets/showcase-guide.pdf#page=1&height=420|Showcase guide]]

## 표와 코드

| 문법 | 웹 출력 |
| --- | --- |
| `\[\[note\]\]` | 공개 글 링크 |
| `\[\[note#Heading\]\]` | 공개 heading anchor |
| `\[\[note^block\]\]` | 공개 block anchor |
| `==highlight==` | mark 스타일 |

```ts
const source = "Obsidian";
const target = "Astro";
console.log(`${source} -> ${target}`);
```
