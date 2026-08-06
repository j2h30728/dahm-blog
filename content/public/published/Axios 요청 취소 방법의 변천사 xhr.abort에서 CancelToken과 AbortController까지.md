---
type: blog-post
status: "published"
title: "Axios 요청 취소 방법의 변천사: xhr.abort에서 CancelToken과 AbortController까지"
description: "Axios의 HTTP 요청 취소 방법이 어떻게 변화해 왔는지에 찾아봤다. xhr.abort에서 시작하여 CancelToken, 그리고 AbortController로 발전해 온 과정을 살펴보며, 각 방법의 도입 배경을 분석한다."
date: "2024-11-24"
updated: "2026-07-12"
published: true
slug: "axios-cancel"
tags: []
source: "https://velog.io/@rachel28/axios-cancel"
thumbnail: "https://velog.velcdn.com/images/rachel28/post/290dd451-4ef5-4313-b6de-327c34e86572/image.jpg"
---

# Axios 요청 취소 방법의 변천사: xhr.abort에서 CancelToken과 AbortController까지

모던 딥다이브 자바스크립트 스터디에서 `XMLHttpRequest` 객체의 `abort` 메서드를 읽고 문득 궁금증이 생겼다. `XMLHttpRequest`로 만든 Axios는 요청 취소하는 방법은 다른 방법을 사용하고 있었던 것 같은데, 왜 직접적으로 `xhr.abort` 메서드를 사용하지않고 다른 방식을 선택했을까 생각이 들었다.

많은 사람들이 참여해서 만들고 사용하는 Axios에서 요청 취소를 구현하는 데에는 분명히 합리적인 이유가 있을 것 같아 찾아보았다.

## xhr.abort 란?

`XMLHttpRequest`는 브라우저가 서버에게 비동기 요청을 보낼 수 있게 해주는 Web API이다. 이 객체의 `abort()` 메서드는 이미 `send()` 메서드를 통해 전송된 HTTP 요청을 중단할 수 있는 기능을 제공한다.

- [mdn XMLHttpRequest : abort() method](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/abort)

```jsx
// 출처 : mdn
const xhr = new XMLHttpRequest();
const method = "GET";
const url = "https://developer.mozilla.org/";
xhr.open(method, url, true);

xhr.send();

if (OH_NOES_WE_NEED_TO_CANCEL_RIGHT_NOW_OR_ELSE) {
  xhr.abort();
}
```

 `xhr.abort()`를 호출하면 HTTP 요청을 중단할 수 있으며, 요청 중단 시 상태는 서버 응답을 받기 전의 상태(0;UNSENT)와 동일하게 변경된다. 이때 에러 객체는 타입은 `Error`로 설정되고, 상태는 0(UNSENT이 된다.

<p><img width='400' src='https://velog.velcdn.com/images/rachel28/post/949e9303-4da7-4ec6-b8ac-44998cd5fe2d/image.png' /></p>


## Axios에서의 요청 취소 방법 변천사

Axios는 Promise 기반으로 `XMLHttpRequest`를 사용한 HTTP 요청 라이브러리다. 그런데 Axios에서 직접적으로`xhr.abort()` 사용하는 대신 다른 방법을 사용해 요청을 취소한다. 

<p><img width='600' src='https://velog.velcdn.com/images/rachel28/post/92bae373-e539-427e-8c92-d5d50e9b53c4/image.png' /></p>


### 1. XMLHttpRequest의 abort() 메서드 사용 문제 (2015년 3월)

2015년 3월, Axios에서 `XMLHttpRequest`의 `abort()` 메서드를 사용하여 요청을 취소하는 방법에 대해 논의가 있다. 그러나 Promise 기반의 Axios 구조에서는 `abort()` 메서드의 사용이 적절하지 않다는 의견이 있었다.

- 관련 Git Iusse : [GitHub Issue #50](https://github.com/axios/axios/issues/50)

Axios는 요청을 보낼 때 `XMLHttpRequest`으로 요청하는 로직을 Promise  객체로 래핑하여 반환한다. 이로 인해 `xhr.abort()` 메서드를 구조적으로 사용할 수 없다.
- 자바스크립트의 클로저를 사용하여 Promise 객체안에 캡슐화 되어 외부스코프에서 접근이 불가능하다.
- resolve와 reject 메서드로만 상태변경이 가능하며, 내부로직이나 상태를 변경할수 없다.(xhr.abort() 와 같은)
- Promise 객체 안에서 `new XMLHTTPRequest`가 실행되기 때문에 Promise가 반환된 시점에서 `XMLHttpRequest`객체가 생성되지 않았을 수도 있기 때문에 `xhr.abort()`을 실행하려 해도 xhr 참조 값이 없을 수 있다.
```jsx
// 당시 xhr 요청
module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
  // 생략
	  }
  }
// 당시 http 요청
module.exports = function httpAdapter(config) {
  return new Promise(function dispatchHttpRequest(resolve, reject) {
  // 생략
	  }
  }
```

또한, Axios는 코드 실행 환경에 따라 브라우저라면 `XMLHttpRequest` 인스턴스를 생성하고, Node.js일 경우에는 `http/https` 인스턴스를 생성한다. 
따라서 브라우저에서만 사용할 수 있는 WebAPI인 `xhr.abort()` 는 유지보수 관점에서도 문제가 발생한다.

당시 [GitHub Issue #50](https://github.com/axios/axios/issues/50)에서는 요청 취소와 관련하여 여러 가지 방법이 논의되었다. 
예를 들어, Angular의 `$http`에서 사용되던 `timeout`을 활용하거나 다른 대체 방안들이 고려되었다.

### 2. CancelToken 도입 제안 (2016년 5월, 10월)

2016년 5월, Axios는 요청을 취소하고 해당 취소를 처리하기 위한 메커니즘을 결정하는 논의가 시작되었고 같은해 10월에 최종적으로`CancelToken`으로 결정되었다. 

- 제안 Git Issue : [GitHub Issue #333](https://github.com/axios/axios/issues/333)
- CancelToken 도입 Pull Request: [GitHub PR #452](https://github.com/axios/axios/pull/452)

> 도입되었던 CancelToken 은 현재 중단되었다.
> 
> 
> ![](https://velog.velcdn.com/images/rachel28/post/3e1f272e-3361-46f0-bf39-db177ff3c424/image.png)
> 
> 위의 사진 내용을 확인하면 [proposal-cancelable-promises](https://github.com/tc39/proposal-cancelable-promises) 을 기반으로 생성되었다는 것을 알 수있다.
> 
> Git Issue #50와 [#333 에서 해당 라이브러리의 컨트리뷰터](https://github.com/axios/axios/issues/333#issuecomment-240506469)를 만날 수 있는데, Promise에서 pending, fulfilled, rejected 상태 뿐만 아니라 취소 상태도 있어야한다는 주장을 한다. 
> TC39에도 제안했지만, 상태가 많아 짐에 따라 복잡성이 증가하고 일관성 해칠 수 있기 떄문에 제안은 성사되지 못했다.
> 
> - 관련 내용 : https://github.com/tc39/proposal-cancelable-promises/issues/70

### [cancle token 사용 방법](https://axios-http.com/docs/cancellation)

```jsx
const CancelToken = axios.CancelToken;
const source = CancelToken.source(); // 재사용 가능한 요청 취소 토큰 생성

// 요청 생성
axios.get('/user/12345', {
  cancelToken: source.token // 요청 취소를 할 수 있는 토큰 주입
}).catch(function (thrown) {
  if (axios.isCancel(thrown)) {
    console.log('Request canceled', thrown.message); // 요청이 취소된 경우의 메시지 출력
  } else {
    // 일반적인 오류 처리
  }
});

axios.post('/user/12345', {
  name: 'new name'
}, {
  cancelToken: source.token // 동일한 취소 토큰을 사용하여 POST 요청에도 취소 기능 제공
})

// 버튼 클릭 이벤트 핸들러에서 요청 취소 (원하는 곳에 추가)
document.getElementById('cancel-button').addEventListener('click', function () {
  // 요청 취소 호출 및 메시지 전달
	// 취소 요청 시 표시될 메시지로, 요청 취소 이유를 명확히 알 수 있게 한다
  source.cancel('Operation canceled by the user.');
});
```

### 3. CancelToken의 메모리 누수 문제 (2020년 6월)

2020년 6월, `CancelToken`을 여러 요청에서 재사용할 경우 메모리 누수가 발생한다는 문제가 보고되었다. 요청이 완료된 후에도 구독 해제 기능이 없어 `CancelToken`에 대한 참조가 유지되어 메모리가 해제되지 않았기 때문이다.

- 관련 Git Iusse : [GitHub Issue #3001](https://github.com/axios/axios/issues/3001)

### 4. AbortController 지원 및 CancelToken 개선 (2021년 9월)

2021년 9월, Axios는 `CancelToken`의 메모리 누수 문제를 해결하고, 브라우저의 표준 API인 `AbortController`를 지원하기 위한 업데이트를 진행했다. 이를 통해 표준화된 방식으로 요청을 취소할 수 있게 되었다.

- 관련 Pull Request : [GitHub PR #3305](https://github.com/axios/axios/pull/3305)
- AbortController : https://developer.mozilla.org/ko/docs/Web/API/AbortController
- Axios AbortController 적용 방법 : https://axios-http.com/docs/cancellation

```jsx
const controller = new AbortController();

axios.get('/foo/bar', {
		signal: controller.signal // 요청 취소를 위한 AbortController 신호 주입
	}).then(function(response) {
		// 요청 성공 시 처리 로직
	}).catch(function (thrown) {
		if (axios.isCancel(thrown)) {
				console.log('Request canceled:', thrown.message); // 요청이 취소된 경우의 메시지 출력
			} else {
				// 일반적인 오류 처리
			}
	});

// 버튼 클릭 이벤트 핸들러에서 요청 취소 (원하는 곳에 추가)
document.getElementById('cancel-button').addEventListener('click', function () {
		controller.abort(); // 요청 취소 호출
});
```

## 마무리

부끄럽지만, 라이브코딩 면접중에 abort signal 을 추가하라는 과제를 기점으로 HTTP 요청 취소에 대해서 고려하게 되었다. 비록 그때의 면접에서는 떨어졌지만, 새로운 지식을 배우게 된 기쁨에 개인프로젝트에서 취소 요청이 필요한 부분에 추가했기도 했다.

- 취소요청 기능을 추가했던 내용 : https://github.com/j2h30728/dam-witter/pull/74

이런 과거때문인지, `XMLHttpeRequest` 부분을 읽다가 abort 기능이 눈에 꽂혀 짧은 지식으로 Axios와 연결지어 생각하게 되었고, `CancelToken` 도입과 중단, `AbortController` 지원 순의 변천사를 찾아보게 되었다.

이 과정에서 Promise 구조 기반이기 떄문에 `xhr.abort`는 사용하기 힘들다는 말을 이해하기 위해서 당시 코드를 찾아보기도 했다. 
취소요청 내용과 관련된 초기 코드와 관련된 과거의 Git Issue와 Pull Request를 탐색하며 다양한 개발자들이 소통하고 협력하며 현재의 Axios를 만들어왔다는 점이 정말 멋지고 재밌었다.

잘못된 내용이 있을 경우 댓글로 알려주세요!🙏
