---
type: blog-post
status: "published"
title: "AWS Lambda + API Gateway로 Serverless API 만들기"
description: "AWS Lambda + API Gateway을 사용해서 Wrapping APi 만들기."
date: "2024-07-07"
updated: "2026-07-06"
published: true
slug: "AWS-Lambda-API-Gateway"
tags: ["aws"]
source: "https://velog.io/@rachel28/AWS-Lambda-API-Gateway"
thumbnail: "https://velog.velcdn.com/images/rachel28/post/fea36732-7a11-4121-b5f9-4dbb916d6f55/image.jpg"
---

# AWS Lambda + API Gateway로 Serverless API 만들기

당시 원하던 목표는 외부 API 요청시에 param으로 요구되는 key 값들을 숨기는 것과 환경변수를 사용할 수 없는 상황이었다. 그래서 AWS Lambda와 API Gateway를 사용하여 API를 Wrapping하였다.

## AWS Lambda 함수와 API GateWay

- [**AWS Lambda 함수**](https://aws.amazon.com/ko/lambda/): 서버를 프로비저닝하거나 관리할 필요 없이 코드를 실행할 수 있게 해주는 서버리스 컴퓨팅 서비스. 특정 이벤트에 의해 트리거되며, 요청이 있을 때만 실행된다.
- [**API Gateway**](https://aws.amazon.com/ko/api-gateway/): 클라이언트의 요청을 받아 Lambda 함수로 전달하고, Lambda 함수의 응답을 클라이언트에게 전달하는 역할. API Gateway는 다양한 API 메서드(GET, POST 등)를 정의하고, 각 메서드가 어떤 Lambda 함수를 호출할지 설정할 수 있다.


<p center ><img src='https://velog.velcdn.com/images/rachel28/post/926bcb22-3f94-4f23-8239-8d488e58c3c7/image.png' width='600' /></p>

1. **API 소비자(클라이언트)**: 사용자는 웹 애플리케이션 또는 모바일 애플리케이션을 통해 API 요청을 보냄
2. **API 게이트웨이**: 클라이언트의 요청을 받아 적절한 Lambda 함수로 전달
3. **AWS Lambda 함수**: API Gateway로부터 받은 요청을 처리하고, 필요한 작업을 수행한 후 응답을 반환함
4. **API 게이트웨이**: Lambda 함수의 응답을 받아 클라이언트에게 전달

> **만들고자 하는 Wrapping API**
> 
> 1. 캐릭터 리스트 (`/api/characters`)
> 2. 캐릭터 상세 데이터 (`/api/character/${characterId}`)

## API GateWay 구축

API GateWay 생성하기 버튼을 누르게 되면 아래의 선택 항목을 확인할 수 있다.
나는 GET 요청만을 할 두 개의 API를 만들것이기 때문에 HTTP API를 선택했다.

만약 어떤것을 골라야할 지 고민이 된다면 해당 링크의 설명을 확인하면 된다.  : [**API Gateway 사용 사례**](https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/api-gateway-overview-developer-experience.html)

|API 유형 선택|API생성 : 통합 생성 및 구성|
|-|-|
|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/7b9c4131-5941-46ea-ba68-1e0f26e079fc/image.png' width='500' /></p>|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/faa76eab-5569-4c76-b6fc-efa0a2f499aa/image.png' width='600' /></p>|

API이름은 API GateWay에서 구분하기 위함으로 사용된다.
위의 **통합 추가**는 이미 만들어 둔 것과 연결할 때 사용한다. (이미 만들어져있다면 사용 무관)

구축 버튼을 클릭한 후 진행되는 세번째 단계인 스테이지 구성에서는 API 엔드포인트의 URL의 일부로 설정된다.
<p center ><img src='https://velog.velcdn.com/images/rachel28/post/c97b4302-d7b4-40be-9a14-42c458126c17/image.png' width='600' /></p>

APi라는 것을 명시하기위해서 그냥 api로 설정했다. Base URL는 아래와 같이 된다.
`https://####.execute-api.ap-northeast-2.amazonaws.com/[api]`
: `(https://jttiazmtv9.execute-api.ap-northeast-2.amazonaws.com/api)/엔드포인트`

API GateWay 구축 첫 단계에서 스테이지 구성에서 스테이지 이름을 marvel로 설정했었다.
생성 버튼을 통해 아래와 같이 원하는 엔드포인트에 맞는 메서드를 생성한다.


|경로 및 메서드 생성|생성된 API 경로|
|-|-|
|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/70e5127f-418e-40f7-9e44-2a65c4b368d8/image.png' width='600' /></p>|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/d86c3e9c-b13e-45e6-8a86-6029482a6cac/image.png' width='300' /></p>|
## [AWS Lambda **함수 핸들러 정의**](https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/nodejs-handler.html)

처음 빌드해보는 것이며, 빠르게 진행하기 위해 Node.js를 사용하였다.
TypesSript로도 빌드할수 있기 때문에 타입안정성이 우선시 되어야한다면 TypesSript로 진행할 것 같다.

<p center ><img src='https://velog.velcdn.com/images/rachel28/post/78e5018c-98cc-4918-b7eb-bd8b9dedf212/image.png' width='500' /></p>

### 핸들러 조건

- characterId 를 path paramter로 받는다.
- 환경변수(Public key, Private Key) 사용
- API 요청시 필요한 hash값을 위하여 인코딩 작업이 필요하다. 이는  crypto-js를 사용.

<p center ><img src='https://velog.velcdn.com/images/rachel28/post/43a61f7e-fe09-4c78-b82e-086dfb1a4764/image.png' width='700' /></p>

> AWS Lambda 함수 내의 node.js 런타임에서 fetch 를 사용할 경우, `/* global fetch */` 문구 추가 필요
> 

> Lambda 함수에서 환경 변수를 설정하려면, AWS Lambda 콘솔에서 "환경 변수" 섹션에서 추가할 수 있다.
> 

## [Lambda Layers](https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/creating-deleting-layers.html)

AWS Lambda 함수의 코드에서 의존하는 추가 패키지 및 모듈을 사용하려면 Lambda Layers 생성해주어야 한다.

1. 패키지 설치 및 zip 파일로 만든 후에 layers 파일 업로드
2. 원하는 런타임을 선택하고 layers 생성 **(Lambda 함수와 동일한 런타임 버전을 선택해야한다.)**
3. lamdda 함수 설정에서 생성한 layers 추가 및 적용
4. lamdba 함수 내에서 공통 라이브러리 사용가능 (현재 프로젝트는 crypto-js)

|추가된 Lambda Layers|Lambda함수에 Layer 연결|
|-|-|
|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/3a1cd271-0e84-475c-935a-f0dc60328913/image.png' width='500' /></p>|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/9c72c027-66e0-43e3-a691-26812687e78a/image.png' width='600' /></p>|


Lambda Layers를 생성하여 각각의 Lambda 함수에 추가해준다.

## Lambda 함수와 API GateWay 연결

만들어둔 API GateWay에서 “통합 연결”버튼을 클릭하여 엔드포인트와 Lambda 함수를 연결시킵니다.

|만들어둔 API GateWay|“통합 연결”버튼을 클릭 후 화면|
|-|-|
|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/3be2dff9-99ff-4a1d-b17f-1107f65a5a2e/image.png'  /></p>|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/615914b4-35a4-4db9-987c-b9855b28b784/image.png'/></p>|

|캐릭터 리스트|캐릭터 상세 데이터|
|-|-|
|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/211df15f-a43b-4053-bb5f-24b83a30ea3d/image.png'  /></p>|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/6a5e8d97-5f94-4fba-89d4-b566a48c05d4/image.png'  /></p>|



## 호출

|캐릭터 리스트 (`/api/characters`)|캐릭터 상세 데이터 (`/api/character/${characterId}`)|
|-|-|
|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/3c6003b2-7203-46d8-98e4-a6904ee22231/image.png'  /></p>|<p center ><img src='https://velog.velcdn.com/images/rachel28/post/23980c5e-a5ca-492f-91b9-4aac6ddfe85d/image.png'  /></p>|


## 회고

wrapping API는 Next.js 로 밖에 만들어 보질 않았어서 EC2를 띄워야하나 고민했었다. 하지만, EC2 숙련도가 낮았고 가격이 부담스러웠다. 찾아보니 AWS Lambda + API GateWay 조합으로 많이 사용한다는 것을 알고 시도하게되었다.

사실 기록해두고싶어 블로그 포스팅을 한다. 레퍼런스란에서 참고한 글을 보고 진행하는 것이 훨씬 더 편할 수 있다. 

진행하면서 깃이슈에 기록하면서 진행했다. 위의 내용과는 크게 다르지 않다.

- https://github.com/j2h30728/react-s3-cloudfront/issues/1

두려움이 있어 시도 조차 해보지않았던 AWS의 서비스들을 하나씩 해보고 있는데, 도장깨기 같아서 재밌다. 사실 도장이 잘 안깨져서 고민이기도하다.

## 레퍼런스

- [AWS Lambda + API Gateway로 Serverless API 환경 구성하기](https://velog.io/@seeh_h/AWS-Lambda-API-Gateway%EB%A1%9C-API-%EB%A7%8C%EB%93%A4%EA%B8%B0)
- https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/api-gateway-create-api-as-simple-proxy-for-lambda.html
- https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/nodejs-handler.html
- https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/creating-deleting-layers.html
