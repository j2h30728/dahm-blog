# 블로그 이미지 변환과 S3·CloudFront 운영

노션에서 작성한 글의 이미지를 동기화할 때 내려받아 본문용 WebP를 만들고, 원본과 함께 보관한다. 본문은 반응형 변환본을 사용하며 클릭 확대 전에는 원본을 요청하지 않는다. 노션 캡션의 `{width=360}` 표시 너비도 유지한다.

## 실행 모드

- `IMAGE_ASSETS_MODE=off`: 기존 이미지 URL을 유지한다. CDN 설정을 숨겨서 우회하는 용도가 아니라 명시적인 기존 동작 모드다.
- `IMAGE_ASSETS_MODE=local`: AWS 없이 실제 이미지 변환 결과를 `/post-assets/`로 생성한다. 로컬 검증용이며 원본도 클릭 후에만 로드한다.
- `IMAGE_ASSETS_MODE=s3`: 모든 본문 이미지를 변환해 전용 S3에 보관하고 CloudFront URL로 연결한다. 필수 설정·다운로드·변환·업로드 실패는 발행을 중단하며 이전 게시 결과를 유지한다.

```bash
rtk proxy env IMAGE_ASSETS_MODE=local PUBLIC_SITE_URL=https://dahm-lee.com pnpm build:blog
```

프로덕션은 `s3` 모드를 명시한다. 테스트용 local/off 설정을 운영 설정 대신 사용하지 않는다. S3와 CloudFront의 저장·요청·전송 비용이 발생하며 실제 용량·방문량에 따라 달라진다. 요청마다 실행되는 변환 서버나 Lambda는 생성하지 않는다.

## 한 번 설정하면 되는 Vercel OIDC 연결

이미지 변환과 업로드는 Vercel 빌드에서 실행한다. 개인 AWS 계정에서 아래 연결을 한 번 만들면 데스크톱마다 AWS CLI나 액세스 키를 설정할 필요가 없다. 로컬 개발·이미지 검증은 `local` 모드를 사용한다. 업무 계정 키나 버킷은 사용하지 않는다.

### 1. Vercel에서 Team issuer 선택

[dahm-blog 프로젝트](https://vercel.com/j2h30728s-projects/dahm-blog)의 **Settings → Security → Secure backend access with OIDC federation**에서 issuer mode를 **Team**으로 저장한다. 계정의 UI에 따라 항목이 OIDC Federation으로 표시될 수 있다.

| 항목 | 이 프로젝트의 값 |
| --- | --- |
| Team slug | `j2h30728s-projects` |
| Project | `dahm-blog` |
| Provider URL / issuer | `https://oidc.vercel.com/j2h30728s-projects` |
| Audience | `https://vercel.com/j2h30728s-projects` |
| 허용 subject | `owner:j2h30728s-projects:project:dahm-blog:environment:production` |

Global issuer는 이 템플릿과 맞지 않는다. 팀이나 프로젝트 이름을 바꾸면 토큰의 claim도 바뀌므로 공급자·신뢰 정책·템플릿을 함께 수정해야 한다. [Vercel OIDC 공식 문서](https://vercel.com/docs/oidc)

### 2. 개인 AWS 콘솔에서 기존 공급자 확인

개인 AWS 계정으로 로그인하고 우측 상단에서 계정을 확인한다. **IAM → 자격 증명 공급자(Identity providers)**에서 `oidc.vercel.com/j2h30728s-projects`가 있는지 확인한다.

- 없으면 직접 만들지 않아도 된다. 다음 단계에서 `ExistingOidcProviderArn`을 비우면 템플릿이 생성한다.
- 이미 있으면 해당 공급자의 ARN을 복사한다. 공급자 Audience 목록에 `https://vercel.com/j2h30728s-projects`가 포함됐는지도 확인한다. 기존 공급자를 재사용할 때 템플릿이 Audience 목록을 수정하지는 않는다.

동일한 Provider URL은 AWS 계정에 중복 생성할 수 없다. 별도의 IAM 사용자나 장기 액세스 키를 만들 필요는 없다. [AWS 공급자 설정 문서](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)

### 3. CloudFormation에 템플릿 업로드

**CloudFormation → 서울 리전(ap-northeast-2) → 스택 생성 → 새 리소스 사용(표준)**으로 이동한다.

1. 기존 템플릿 사용 → 템플릿 파일 업로드에서 저장소의 [`infra/image-cdn.json`](../infra/image-cdn.json)을 선택한다.
2. 스택 이름은 `dahm-blog-image-cdn`으로 입력한다.
3. `ExistingOidcProviderArn`은 위에서 동일한 공급자를 찾았을 때만 해당 ARN을 입력하고, 없으면 빈 값으로 둔다.
4. 나머지 옵션은 기본값으로 두고, 검토 화면에서 아래 리소스와 권한 범위를 확인한다.
5. CloudFormation이 IAM 리소스를 생성한다는 확인 항목을 선택하고 스택을 생성한다. 역할 이름은 자동 생성되므로 별도 고정 이름을 입력하지 않는다.
6. 상태가 `CREATE_COMPLETE`가 되면 **출력(Outputs)** 탭을 연다. 이미 스택을 만든 상태라면 새 스택 대신 같은 템플릿으로 업데이트하고 `UPDATE_COMPLETE`를 확인한다. 업데이트할 때 `ExistingOidcProviderArn`은 이전 값을 유지한다. 처음 비웠다면 계속 비우고, 기존 ARN을 썼다면 같은 ARN을 유지한다.

템플릿은 전용 S3, CloudFront, OAC, 캐시·버킷 정책, 업로더 정책, OIDC 역할을 생성하며 공급자는 없을 때만 생성한다. S3·CloudFront 사용량에 따른 비용이 발생한다. 버킷 삭제·교체 시 `Retain`으로 기존 파일을 보존하며 이전 이미지나 기존 업무 리소스를 지우지 않는다.

새로 만든 OIDC 공급자도 삭제·교체 시 보존한다. 계정 단위 공급자를 다른 역할이 공유할 수 있기 때문이다. 스택 삭제 후 다시 생성할 때는 남아 있는 공급자의 ARN을 `ExistingOidcProviderArn`에 넣는다. 예전 템플릿으로 공급자를 이미 만들었다면, 생성/재사용 경로를 바꾸기 전에 우선 현재 템플릿의 보존 설정만 적용한 업데이트를 완료해야 한다.

S3는 공개 접근 차단과 BucketOwnerEnforced를 사용한다. 해당 CloudFront 배포만 `blog-images/*`를 읽는다. 새 역할은 이 prefix의 GetObject·PutObject와 전용 버킷의 ListBucket만 허용한다. ListBucket은 HeadObject의 미존재(404)와 권한 오류(403)를 구분하기 위해 필요하다. 삭제·다른 버킷·IAM 관리 권한은 주지 않는다. 역할에는 이 업로더 정책 하나만 연결하고 기존 사용자나 역할에는 자동 연결하지 않는다.

템플릿이 만드는 역할의 신뢰 조건은 다음 두 값을 **StringEquals**로 모두 검사한다. 다른 프로젝트·Preview·Development는 허용하지 않는다. 콘솔에서 별도 신뢰 정책을 수동 작성할 필요는 없다.

```json
{
  "oidc.vercel.com/j2h30728s-projects:aud": "https://vercel.com/j2h30728s-projects",
  "oidc.vercel.com/j2h30728s-projects:sub": "owner:j2h30728s-projects:project:dahm-blog:environment:production"
}
```

### 4. Outputs를 Vercel Production 환경변수에 등록

프로젝트 **Settings → Environment Variables**에서 다음 값을 **Production** 범위로 등록한다. Preview에 같은 s3 설정을 적용하면 Production 전용 신뢰 정책에서 거부되므로, Preview는 `off` 또는 AWS 없는 `local` 모드로 둔다.

| Vercel 환경변수 | 값 |
| --- | --- |
| `IMAGE_ASSETS_MODE` | `s3` |
| `IMAGE_AWS_ACCOUNT_ID` | CloudFormation 출력 `AccountId` |
| `AWS_REGION` | `ap-northeast-2` |
| `IMAGE_S3_BUCKET` | 출력 `BucketName` |
| `IMAGE_CDN_BASE_URL` | 출력 `CdnBaseUrl` 전체 값(이미 `https://` 포함) |
| `AWS_ROLE_ARN` | 출력 `AwsRoleArn` |

`AWS_REGION`은 Vercel 실행 리전 기본값에 의존하지 않고 S3를 만든 서울 리전으로 명시한다. `VERCEL_OIDC_TOKEN`은 Vercel 빌드가 자동 제공하므로 직접 등록하거나 복사하지 않는다. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE`은 이미지 업로드에 필요하지 않으며 코드가 이 값으로 우회하지도 않는다. 프로젝트에 다른 용도로 이미 쓰는 키가 있다면 해당 용도를 확인한 뒤 정리한다.

설정을 저장한 뒤 **Deployments → Production → Redeploy**로 새 빌드를 실행한다. 코드 변경이 아직 원격에 반영되지 않았다면 코드 반영 후 해당 커밋을 배포해야 한다. 이전 배포에 새 환경변수가 소급 적용되지는 않는다.

코드는 공식 `@vercel/oidc-aws-credentials-provider@3.3.7`을 S3Client의 명시적 credentials로 사용한다. provider가 `AssumeRoleWithWebIdentity`로 단기 자격증명을 얻는다. 역할 ARN·계정·빌드 토큰이 없거나 틀리면 이미지 다운로드 전에 오류로 중단하며 PC 키로 대체하지 않는다. 이 버전은 빌드 환경 토큰을 사용하므로 토큰 파일 이름만 제공하는 구성은 지원하지 않는다. [Vercel AWS 연결](https://vercel.com/docs/oidc/aws), [공식 provider 사용법](https://vercel.com/docs/oidc/reference)

### 5. 첫 배포 확인

CloudFront 배포가 `Deployed`이고 Vercel 새 배포가 `Ready`인지 확인한다. 빌드에서 노션 동기화와 이미지 변환·업로드가 성공해야 한다. Sharp는 네이티브 바이너리를 쓰므로 Linux 빌드에서 optional dependency 설치와 실제 변환 실행도 확인한다.

이미지 주소가 CloudFront의 WebP인지, 클릭 전에는 `/original.*` 요청이 없고 클릭 후에만 원본을 받는지 브라우저 Network에서 확인한다. S3 직접 익명 GET 차단과 CDN GET·Content-Type·Cache-Control도 확인한다. 이 단계는 개인 AWS 콘솔 설정과 실제 Vercel 빌드가 끝나야 검증할 수 있다.

## 저장·캐시·실패 처리

- 원본 바이트 해시로 같은 이미지를 구분하고 변환 설정·도구 버전별로 파생 경로를 분리한다. 같은 원본 URL의 내용 변경도 새 파일로 반영한다.
- 변환본은 원본보다 크게 만들지 않는다. 애니메이션의 프레임과 시간, 투명도를 보존하며 지원 불가·크기 제한 초과는 오류로 처리한다.
- 현재 지원 입력은 Sharp가 읽을 수 있는 정지 이미지와 GIF/animated WebP다. SVG는 현재 글 재고에 없어 초기 범위에서 지원하지 않고 오류로 처리한다. 다운로드 25MB, 한 프레임 24MP, 총 128MP, 200프레임, 변환 30초를 한도로 둔다. 실제 글의 864×864×152프레임 GIF도 총 픽셀 한도 안에서 검사한다.
- 변환 정책 버전은 `image-processor.ts`의 `TRANSFORM_VERSION`으로 관리한다. 현재 PNG·GIF는 lossless, JPEG·AVIF는 quality 86을 사용한다. 품질·리사이즈·회전 정책을 바꾸면 `webp-v1` 정책 버전도 반드시 올려 이전 immutable 경로와 캐시를 재사용하지 않게 한다.
- 콘텐츠 타입·체크섬과 `Cache-Control: public, max-age=31536000, immutable`을 지정한다. 해시 URL이 바뀌므로 통상적인 캐시 무효화가 필요 없다.
- 이미지 manifest는 글과 함께 staging·복원 대상이다. 신규 자산 일부를 업로드한 뒤 실패해도 기존 게시물·이미지를 지우지 않는다.
- 실패 시 외부 원본을 본문에 대신 넣지 않는다. 모달 원본 로딩이 실패하면 이미 보이는 최적화 이미지와 오류 안내를 유지하고 닫기는 계속 동작한다.

## 전환 검증과 복구

대표 사진·스크린샷·움짤·세로 사진을 확인한 후 전체 글을 동기화한다. 브라우저 새 세션에서 클릭 전 원본 네트워크 요청이 0건인지, 클릭 이후 해당 원본만 요청하는지 확인한다. 모바일 srcset 선택, 캡션 너비, ESC·바깥 클릭·포커스 복원과 이미지 링크도 검사한다.

AWS 연결 후 S3 익명 직접 GET 차단, CloudFront GET 성공, Content-Type·Cache-Control·캐시 응답을 확인한다. 같은 조건에서 이전/이후 전송량을 측정하며 절감률은 실제 결과로 보고한다. 이전 배포로 롤백할 때는 이전 manifest와 앱 버전을 함께 복원한다. S3의 이전 해시 자산은 남겨 두므로 이전 배포 URL도 유지된다.
