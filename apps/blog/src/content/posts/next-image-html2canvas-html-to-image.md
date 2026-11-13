---
publish: true
title: Next.js 에서 원하는 부분을 캡쳐하여 다운받기 (html2canvas, html-to-image)
slug: next-image-html2canvas-html-to-image
date: 2023-07-28
section: 기술
tags:
  - error
  - html-to-image
  - html2canvas
  - image
  - next
summary: Next.js 로 진행하는 프로젝트에서 html2canvas와 html-to-image 를 사용하며 만난 에러들을 정리했습니다.
---

아래의 긴 글을 읽기전에 Next에서 div 또는 Image 컴포넌트를 사용해 이미지 캡쳐를 진행하다 에러가 발생한 분들을 위한 해결책은 상단에 기록한다.

### 1. [html2canvas](https://github.com/niklasvh/html2canvas)

object-fit 속성이 존재하지 않기 때문에, 해당 속성이 필요하다면 아래 방법들을 추천

1. div 태그의 background-image 의 url 에 이미지를 삽입하여 다운
2. patch-package를 사용해 직접 라이브러리에 object-fit 속성 코드를 삽입 ([html2canvas 깃이슈 참고](https://github.com/niklasvh/html2canvas/issues/3072))

### 2. [html-to-image](https://github.com/bubkoo/html-to-image)

1. 연속 적으로 이미지를 다운받을 때, 두번째 다운로드 부터는 항상 첫 번째의 Image 컴포넌트가 다운로드 될경우에 옵션 목록에 `{ includeQueryParams: true }` 을 추가함

부디, 나와 같은 문제들을 맞닥뜨린 분들이 원활하게 해결했으면 하는 바람이다.

***

[테오스프린트  15기](https://velog.io/@rachel28/teosprint15)에서 진행했던 마인드 팰리스 프로젝트에서 내가 구현한 기능 중에서 에러가 발생했다.

아래와 같이, 카메라 버튼을 클릭하면 폴라로이드 형식으로  `object-fit : ‘contain’` 스타일링이 적용된 이미지 다운받는 것이 목표였다.

![image-ca05e7ebd9bdfc98c56f](/blog-assets/ca05e7ebd9bdfc98c56fba22373da4e40b55c8e6b4829e2a3d6370bb5c2f6dad.png "obsidian-size=449")

## html2canvas

현재 원하는 부분을 캡쳐해서 이미지로 다운로드 하는 기능을 [html2canvas](https://html2canvas.hertzen.com/features) 라이브러리를 사용해 구현하였다.\
애석하게도 html2canvas 는 우리 프로젝트에 필요한 `object-fit : ‘contain’` 속성을 지원하지 않는다.

[html2canvas feature](https://html2canvas.hertzen.com/features)

![image-c3d288e70e26f6d9ad33](/blog-assets/c3d288e70e26f6d9ad333eb67de648a920a7f8c3880f85b6ab24b383e19fff60.png "obsidian-size=372")

## div 태그의 background-image 속성

스프린트 형식으로 2일 동안 개발 해야하기 때문에, 기능 구현을 위해 우회하는 방식을 채택한다.\
div태그에  background-image 속성에 url을 넣어주는 방식이다.

```typescript
const MemoryImage = styled.div<{ src: string }>`
  background-image: url(${(props) => props.src});
  width: 100%;
  min-width: 307px;
  height: 435px;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
`
```

이 방식은 깃이슈와 많은 블로그글들이 추천하는 방식이다.

테스트를 위해 로컬에 직접 이미지를 연결했을 때는 에러 없이 스타일링이 적용된 이미자 다운됨을 확인했다.

### html2canvas 에러  : div 태그

하지만, 데이터베이스를 연결하고 다른 잠재적인 에러들과 함께 충돌이 나면서 원하는 이미지가 다운받아지지않는 현상이 일어난다.

![image-7f1d28004cfc26f6850d](/blog-assets/7f1d28004cfc26f6850d6e3cd37646136f6533e5767a2c0c6ae70bd976690e84.png "obsidian-size=484")

![image-abdd7202668145570814](/blog-assets/abdd7202668145570814032aa3e811829e141b020677ded34de127b4e06397f4.png "obsidian-size=434")

아….어딨어 내 이미지...

## Next Image 컴포넌트 사용

다시 원점으로 돌아간다.

로컬에서는 가능 하던 기능이 데이터 베이스를 연결했을 때는 동작하지 않는 부분에서 어떤 것이 문제의 원인인지 파악하지 못했다.\
이미지의 로드 완료 유무를 확인할 수 없기때문에 디버깅 조차 되지않았다.

> 물론, 이미지가 로드가 완료 될 정도의 시간을 기다리고 다운로드 했지만 동작하지않았다.
>
> 해당 에러를 통해 깨달은 것이 있다.\
> 이미지 로드 완료가 되지않았을 때, 사용자가 기능에  접근하게되면 기능에 문제를 일으킬 수 있는 크리티컬한 문제가 될수있다는 것이다.

div 태그를 사용해 우회하지않고 Next Image 에서 제공하는 기능을 함께 써서 진행해보자.

Next Image 에서 제공하는 속성중에는 [onLoadingComplete](https://nextjs.org/docs/pages/api-reference/components/image#onloadingcomplete)이 있다.\
이미지가 완전히 로드되었을 경우 호출되는 콜백함수가 존재한다.

```typescript
<Image onLoadingComplete={(img) => console.log(img.naturalWidth)} />
```

이미지 다운로드버튼의 default 값을 disabled 시킨다.\
이 콜백함수가 실행되면 이미지로드가 완료될테니, 사진다운로드 버튼을 활성화 시켜서 사용자가 이미지가 완전히 로드되고 난뒤에 이미지다운로드 기능을 사용할 수 있게 한다.

```typescript
import Image from 'next/image'

//중략

<>
	<Main ref={downloadImageRef} id={downloadImageId}>
		<ImageWrapper>
			<Image
				alt={text}
				src={backgroundImage}
				fill
				sizes="100vw"
				style={{
					objectFit: 'contain',
				}}
				onLoadingComplete={() => setIsImageLoaded(true)}
		</ImageWrapper>
		<Text>{text}</Text>
	</Main>
	<DownloadButton onClick={handleCapture} disabled={!isImageLoaded}>
	<CameraIcon fill={isImageLoaded ? 'black' : 'LightGray'} width={50} />
	</DownloadButton>
</>

// 생략
```

`object-fit: ‘contain’` 없다던 html2canvas 에 어떻게 스타일링을 적용해서 다운받을 수 있을까?

### html2canvas 에 `object-fit : 'contain'` 속성 추가하기

라이브러리에 없다면 우리가 추가해보자.

해당 내용은 html2canvas [깃이슈](https://github.com/niklasvh/html2canvas/issues/3072)를 통해 알게 되었다.\
[patch-package](https://github.com/ds300/patch-package) 를 사용해 object-fit 관련 코드 패치파일을 적용하고 next build 폴더를 삭제한 후에 사진 다운로드 받기를 진행해보았다.

![image-9178aa38907fa4a28c25](/blog-assets/9178aa38907fa4a28c253212ac4a75e9e4ad5a90f080ba5daaf68624f54511ad.png "obsidian-size=555")

![image-9f0bb8f1abc96381ef9a](/blog-assets/9f0bb8f1abc96381ef9adcec6205255d7f43393ecf059f759e356edb4398418c.png "obsidian-size=342")

어…?

`object-fit: ‘contain’` 이…적용이 되긴했는데, 나의 사랑스러운 이미지가 왜…크롭되는거지?

현재 이백넘개 다운로드 테스트를 진행하고 분석해본다면, 현재 이미지가 크롭되어 다운받아지는 것은 Next Image 의 문제가 아닌 html2canvas의 문제임을 추측할 수 있을 것같다.\
( 사실 처음에는 Next Image의 캐싱기능의 문제인지 오해했다.)

![image-cca19c154146dd6721ae](/blog-assets/cca19c154146dd6721ae6079aeebf15c9af074612a14b9953eaf3f17b688beb8.png "obsidian-size=623")

\
정말 웃기게도 해당 페이지에 어느 시간정도 체류 하고있다가 사진 다운로드 기능을 누른다면 위와 같이 원하는 방식대로 사진을 다운 받을 수 있다.

![image-de8245959883d2ef2a2d](/blog-assets/de8245959883d2ef2a2d9dc4715ba69cfb9f5b5dd03d7e9cb60e84ef34989813.png "obsidian-size=304")

..?

아무리 우리 프로젝트가 감성이 주 컨셉이어도….이미지 다운로드를 시간을 두고 다운로드 하게 하는 방법은…기획 하지 않은것이다.

사실 팀원들과 다른 지인분들께 해당 문제들을 공유했을 때, 웃프게도 다들 감성적이게 기다리게하는 방법도 고안하는거 나쁘지 않겠다라는 우스갯소리도 들었다.

## 팀에게 요청하기

여기까지 해결책을 찾아 달려올 떄가지 소요한 시간이 적지도 않다.\
커밋로그나 해당 도움을 요청하는 쓰레드의 날짜를 확인해보면 7월 1일 부터 시작한다. (현재는 7월 28일)

![image-aba10e657522ef29fa21](/blog-assets/aba10e657522ef29fa211561bc049e77b47633fda0c649e4e0214354cb9369cd.png "obsidian-size=666")

내가 활동하는 개발 커뮤니티에서 도움을 받으며 여기까지 왔는데, 이제는 팀과 상의하기위해 팀 디스코드에 공유했다.\
팀에 도움을 요청한 대화는 너무 추측과 사담 등 정리되지 않는 내용이라, 개발 커뮤니티에 상황 공유를 위해 올렸던 채팅을 가져왔다.\\

![image-8649436bff8238cf6178](/blog-assets/8649436bff8238cf6178c65c19623b63081f2428e6d8bcb071c9dd37b444582d.png "obsidian-size=660")

다른 팀원이 해당 문제 해결방법을 알고 있을지, 또는 html2canvas 를 교체할 것인지 등의 팀과 상의 하기위해 draft pull request를 작성해서 공유하였다.

[해당 풀리퀘](https://github.com/miind-palace/mind-palace-FE/pull/63)

## [html-to-image](https://github.com/bubkoo/html-to-image) 로 라이브러리 변경

draft pull request 를 보내고 프짱(프론트엔드-프로젝트리드, 이하 프짱)인 곰곰이 아래와 같은 리뷰를 남겨준다.

![image-a45df3531e608779c7bb](/blog-assets/a45df3531e608779c7bb2922f82abeca479fd400644dafb6595f6fc656ed9d7d.png "obsidian-size=646")

readme 에서 사용방법을 확인해보면 html2canvs와 비교하면 canvas로 전환하는 부분만 다른 것을 확인할 수있다.

라이브러리에서 명시하는 대로 코드를 작성해서 적용해줬었을 때, 만나고 싶지않은 에러가 또 만나게 된다.

![image-e583a4b31fb8f7c0bc25](/blog-assets/e583a4b31fb8f7c0bc25bf003bc0550ca895aed84029d43d5b6c1f5b987f2549.png "obsidian-size=364")

아, 제발...

### 두번째로 다운받는 이미지는 왜 첫번째 Image src 와 동일한 값 일까?

첫 번째로 다운 받은 이미지

![image-4ed9b317ffae3ecd5908](/blog-assets/4ed9b317ffae3ecd5908604c260f3b170c3f90f378acc8e2836b6c346197b88e.png "obsidian-size=525")

두 번쨰로 다운 받은 이미지

![image-0c8cc2e776ddb9e22d33](/blog-assets/0c8cc2e776ddb9e22d33ab18140973c307f7d7289dddd812fa6a902ba0857b40.png "obsidian-size=536")

위의 사진을 확인하면, 텍스트는 온전하게 캡쳐되어서 다운로드가 된다는 것을 확인할 수있는데, Next Image 의 src 값이 첫 번째로 다운로드된 값에서 변경되지않는 것을 확인할 수 있다.

이를 해결하기 위해서 html2canvas 와 동일하게 해당 깃이슈를 확인해 보았다.

[나와 같은 에러가 발생되어 작성된 깃이슈](https://github.com/bubkoo/html-to-image/issues/377)를 확인 할 수있었고, 아래의 답글을 통해 나 또한 해결했다.

```typescript
const dataUrl = await toPng(element.current, { includeQueryParams: true })
```

옵션 목록에 `includeQueryParams: true` 을 추가해주는 것이다.

해당 옵션에 대한 설명은 html-to-image 의 README에서 확인할 수 있다.

> [**includeQueryParams**](https://github.com/bubkoo/html-to-image/tree/9083028a222c6ebc0063ca690c7f066984878c38#includequeryparams)
>
> Set false to use all URL as cache key. If the value has falsy value, it will exclude query params from the provided URL.
>
> Defaults to `false`

문제없이 다운로드 되는 이미지.

![image-e18f6dcb44d5d12a44e3](/blog-assets/e18f6dcb44d5d12a44e35e4d76c9dea49f675cbed98da42181248d8181aef6aa.png "obsidian-size=501")

하지만, html-to-image 로 라이브러리를 변경함과 동시에 다운로드 진행시간이 길어졌다.

html-to-image 가 동작되는 사이에 로딩 상태를 주입해주어 사용자에게 다운로드 상태를 알려주기 위한 작업을 추가했다.

```typescript
const handleCapture = async () => {
    if (isImageLoaded) {
      setIsDownloadImageLoading(true)
      await downloadILmage(downloadImageRef) // html-to-image 로직
      setIsDownloadImageLoading(false)
    } else {
      window.alert('이미지가 로드되지 않았습니다.')
    }
  }
```

캡쳐된 이미지 다운로드하는 로딩상태는 디자인과 밀접하게 연결 되어있으므로 팀에게 해당사항을 공유했고 답변을 받은 상태이다.

![image-c3c0e667473f06656b02](/blog-assets/c3c0e667473f06656b026dc813c48aafe591792b82be7015db8c495fd524d3e8.png "obsidian-size=665")

이제 내 코드상에서 html2canvas 는 제거하고, 캡쳐된 이미지를 다운로드하는 로딩을 연결할 예정이다.

이 문제들을 계속해서 해결 해 나가고 있는 [풀리퀘](https://github.com/miind-palace/mind-palace-FE/pull/63)가 머지않아 merge가 된다고 하니 너무 기쁘다.
한달 동안 시행 착오가 있었던 것들이, 동일한 에러를 마주한 사람은 하루만에 해결되길 빈다.

![image-fbf15935bef1b07cb562](/blog-assets/fbf15935bef1b07cb562fbbe58edd2fb0919101885e344bd2cdd80293edddcdb.png "obsidian-size=394")

해당 에러를 해결하기 위해 힘써주신 태영님께 감사를 표합니다.\
개발 공부를 시작하며 태영님을 만나뵙고 많은 배움을 얻을 수 있어서 행복하고 즐거워요.\
정말, 태영님은 제 롤모델이에요. 😁😁

***

[Velog 원문](https://velog.io/@rachel28/next-image-html2canvas-html-to-image)
