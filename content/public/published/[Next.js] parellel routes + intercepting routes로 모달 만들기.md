---
type: blog-post
status: "published"
title: "[Next.js] parellel routes +  intercepting  routes로 모달 만들기"
description: "next.js app router에서 추가된 Parallel Routes와 Intercepting Routes를 이용한 모달 만들기"
date: "2024-05-14"
updated: "2026-07-10"
published: true
slug: "Next.js-parellel-intercepting-routes로-모달-만들기"
tags: ["React", "app router", "next"]
source: "https://velog.io/@rachel28/Next.js-parellel-intercepting-routes로-모달-만들기"
thumbnail: "https://velog.velcdn.com/images/rachel28/post/07de54e7-5328-44c5-9248-5ccf9a5e9131/image.png"
---

# [Next.js] parellel routes +  intercepting  routes로 모달 만들기

Next.js의 App router을 이용하여 모달을 만들어보기로 했다.
모달을 만들기 앞서, 사용하는 기술인 Parallel Routes와 Intercepting Routes의 개념을 짚고 넘어간다.

## **[Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)**

> Parallel Routes allows you to simultaneously or conditionally render one or more pages within the same layout. They are useful for highly dynamic sections of an app, such as dashboards and feeds on social sites.
> 
> 
> 병렬 경로를 사용하면 동일한 레이아웃 내에서 하나 이상의 페이지를 동시에 또는 조건부로 렌더링할 수 있습니다. 대시보드나 소셜 사이트의 피드와 같이 앱의 매우 동적인 섹션에 유용합니다.
> 

즉, Parallel Routes를 사용하여 두 가지 페이지를 동시에 렌더링할 수 있다.

### Slots

병렬로 라우팅될 때 어떻게 Routes를 구분할 수 있을까?

slots 개념을 사용해서 구분하며, 각각의 Slots들은 `@폴더이름` 의 규칙을 사용한다.

![](https://velog.velcdn.com/images/rachel28/post/aee28202-12d1-4fd6-a925-68e4d6101a1e/image.png)


`@analytics`와 `@team` 두 가지 Slots을 사용해 병렬적으로 라우팅할 수 있다.

각 slots이 공유하는 부모 컴포넌트에서 props로 전달된다.

현재는 root에서 두 개의 Slots을 만들었기 때문에 `app/Layout.tsx`로 최상위 layout 컴포넌트에서 Parallel Routes를 세팅할 수 있다.

```tsx
export default function Layout({
  children,
  team, // slot
  analytics, // slot
}: {
  children: React.ReactNode
  analytics: React.ReactNode 
  team: React.ReactNode
}) {
  return (
    <>
      {children}
      {team}
      {analytics}
    </>
  )
}
```

- slots은 route segments가 아니며 URL 구조에 영향을 주지 않음
- `children`: 기본적인 라우팅
- `team`, `analytics`: Parallel Routes를 위하여 slots 추가

parellel rotues를 사용하여 사용자 역할과 같은 특정 조건에 따라 조건부로 경로를 렌더링할 수 있다.

아래의 코드는 역할에 따라 다른 페이지 렌더링한다. 

```tsx
import { checkUserRole } from '@/lib/auth'
 
export default function Layout({
  user,
  admin,
}: {
  user: React.ReactNode
  admin: React.ReactNode
}) {
  const role = checkUserRole()
  return <>{role === 'admin' ? admin : user}</>
}
```

### Slots 내부에 렌더링 되는 콘텐츠

- **Soft Navigation**: 부분 렌더링을 수행하여 slots 내 페이지를 변경하는 동시에 다른 slots의 활성 페이지가 현재 URL과 일치하지 않더라도 유지한다.
    - 모달을 켤 경우 slots 내 다른 슬롯 활성 페이지(리스트 페이지)  유지한 채로 새로운 모달(다른 슬롯의 페이지)을 렌더한다.
- **Hard Navigation**: Full-page load(브라우저 새로고침) 후, 현재 URL과 일치하지 않는 slots은 Next.js가 알 수 없기 때문에 `default.tsx` 파일을 렌더링한다. (default.tsx가 없을 경우 404를 렌더한다.)

> 모달을 켜는 버튼이 존재하는 페이지와 모달을 렌더하는 페이지를 병렬적으로 라우팅하기 위해 사용
> 

## **[Intercepting Routes](https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes)**

> Intercepting routes allows you to load a route from another part of your application within the current layout. This routing paradigm can be useful when you want to display the content of a route without the user switching to a different context.
> 
> 
> 경로를 가로채면 현재 레이아웃 내에서 애플리케이션의 다른 부분에서 경로를 로드할 수 있습니다. 이 라우팅 패러다임은 사용자가 다른 컨텍스트로 전환하지 않고도 경로의 콘텐츠를 표시하려는 경우에 유용할 수 있습니다.
> 

사실 interceptin routes는 parellel routes와 함께 사용하지않고 단독으로 사용할 때에는 어떤 이점이 있을지 잘 모르겠다.

### Convention

`(.)`: 같은 레벨의 세그먼트를 일치
`(..)`: 한 수준 위의 세그먼트와 일치
`(..)(..)`: 두 수준 위의 세그먼트와 일치
`(...)`: 루트 앱 디렉터리에서 세그먼트를 일치

## [모달 만들기](https://github.com/j2h30728/take_notes/tree/30384e8bddfb1db9837a25962e65812626945d3f/next.js/next.js-modal)

1. 리스트 페이지에서 사진을 클릭하면 리스트 페이지를 오버레이하여 모달이 표시된다.
    a. Intercepting Routes를 사용하여 모달 구현
    b. 리스트 페이지를 오버레이하여 띄울 모달을 Slots를 추가하여 Parallel Routes를 사용
2. 모달을 확인하는 디테일 페이지는 Intercepting Routes로 만든 모달 뿐만 아니라 페이지 자체로도 라우팅 되어야 한다.
    a. 두 가지의 페이지 파일을 생성한다. 
   - `@modal/(.)photos/[id]/page.tsx`: 리스트 페이지에서 모달을 표시하는 버튼을 클릭할 경우 렌더할 모달
   -  `photos/[id]/page.tsx`: 직접 URL로 접근하거나, `photos/[id]`에서 새로고침을 할 경우 렌더할 페이지<br/> ( 두 상황에서는 Next.js가 리스트페이지의 내용을 할 수 없기 때문)

3. 이전 경로로 이동하지 않고 뒤로 가 모달을 닫는다. / 앞으로 가기 버튼을 누를때 모달을 다시 열기.
    a. `useRouter`의 `router.back()`을 사용하여 모달을 닫는다.

### 폴더 구조

```bash
// 폴더 구조

├── app
│   ├── @modal // Parallel Routes
│   │   ├── (.)photos // Intercepting Routes
│   │   │   └── [id]
│   │   │       └── page.tsx // Soft Navigation으로 띄우는 모달
│   │   └── default.tsx // Modal Slots을 렌더하지 않을 상황에 사용
│   ├── error.tsx
│   ├── layout.tsx // Slots을 조작할 공통 부모 컴포넌트
│   ├── page.tsx
│   └── photos
│       └── [id]
│           └── page.tsx // 직접 URL로 접근하거나 새로고침할 경우 렌더

```

### Layout.tsx

`@폴더이름`으로 지정한 Slots를 Layout 컴포넌트에서 props로 내려준다.

```tsx
// app/Layout.tsx

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {children}
        {modal}
        <div id="modal-root"></div>
      </body>
    </html>
  );
}

```

띄우는 모달은 modal 슬롯에서 포탈을 사용하여 화면에 띄우기 위하여 `<div id="modal-root"></div>`도 추가한다.

### default.tsx

Slots에 매칭되지 않는 경로(phtos/:id)거나 새로고침할 경우 렌더할 컴포넌트. 만약, `default.tsx`가 존재하지 않으면 404 에러가 난다.

```tsx
// app/@modal/default.tsx

export default function Default() {
  return null;
}

```

### 모달

```tsx
// app/@modal/(.)photos/[id]/page.tsx

export default async function PhotoModal({ params: { id: photoId } }: { params: { id: string } }) {
  return (
    <Modal>
      /** 모달 컨텐츠 */
    </Modal>
  );
}

```

### 페이지

```tsx
// app/photos/[id]/page.tsx

export default async function PhotoPage({ params: { id: photoId } }: { params: { id: string } }) {
  return (
    /** 페이지 컨텐츠 */
  );
}

```

- **Parallel Routes**: URL 세그먼트가 다르지만 모달 컴포넌트가 리스트 페이지를 오버레이.
- **Intercepting Routes**: URL 링크는 마스킹 처리되어 리스트 페이지와 모달이 같은 화면에 렌더된다.
    - 단, 새로고침을 하거나 직접 URL 접근 시에는 페이지로 렌더

|리스트페이지(피드)|모달(parellel routes) |페이지(page routes)|
|-|-|-|
|<img src='https://velog.velcdn.com/images/rachel28/post/7b933722-1106-4adf-b97c-06e517db595d/image.png'/> | <img src='https://velog.velcdn.com/images/rachel28/post/ca535529-3f7b-4031-979f-9c5f4b59276e/image.png'/> |<img src='https://velog.velcdn.com/images/rachel28/post/2461e34c-139a-426b-a555-ec5d67041daf/image.png' /> |


<br/>
<br/>

번외로 모달에서 포탈을 제외할 경우(병렬적으로 나란히 렌더할 경우), 레이아웃 컴포넌트에서 설정해준 것과 같이 병렬적으로 렌더된다.

- **Parallel Routes**: 현재 레이아웃 컴포넌트에서 구조적으로 스타일링을 적용하지 않았기 때문에 세로로 나란히 렌더된 모습
- **Intercepting Routes**: URL 링크는 마스킹 처리됨

![](https://velog.velcdn.com/images/rachel28/post/7d05d392-b1fe-47b8-898f-8df59e0154d1/image.png)

## 마무리

공식 문서와 예제가 너무 잘 되어 있어서 습득하기에 힘들지는 않았다.

위의 내용도 사실상 같은 내용을 반복해서 말하고있다. 푸하하!

사실, 처음에는 페이지 컴포넌트를 만들지 않고 parellel routes + Intercepting Routes를 먼저 만들었었는데 에러를 맛보고 나서야 깨달았다. 
소매치기할 사람이 없는데 허공에다가 소매치기하고 있었다는 것을.


---
#### 레퍼런스
- [Next.js 공식문서](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
- [공식문서 예제 레포지토리](https://github.com/vercel/nextgram)
