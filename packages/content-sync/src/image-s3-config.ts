import type { S3ClientConfig } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

/** 운영 이미지는 Vercel OIDC만 사용하며 PC의 AWS 키·프로필로 우회하지 않는다. */
export function imageS3Config(
  env: NodeJS.ProcessEnv = process.env,
  providerFactory: typeof awsCredentialsProvider = awsCredentialsProvider,
): S3ClientConfig {
  const region = env.AWS_REGION?.trim();
  const accountId = env.IMAGE_AWS_ACCOUNT_ID?.trim();
  if (!region || !accountId || !/^\d{12}$/.test(accountId)) {
    throw new Error("S3 이미지 OIDC 설정에는 AWS_REGION과 IMAGE_AWS_ACCOUNT_ID가 필요합니다.");
  }

  const roleArn = env.AWS_ROLE_ARN?.trim();
  const role = roleArn && /^arn:aws:iam::(\d{12}):role\/[A-Za-z0-9_+=,.@/-]+$/.exec(roleArn);
  if (!role) throw new Error("S3 이미지 OIDC 설정에는 올바른 IAM 역할 ARN인 AWS_ROLE_ARN이 필요합니다.");
  if (role[1] !== accountId) throw new Error("AWS_ROLE_ARN의 계정이 IMAGE_AWS_ACCOUNT_ID와 다릅니다.");

  // 선택한 공식 provider 버전은 빌드의 환경 토큰을 사용한다. 토큰을 직접 교환·기록하지 않는다.
  if (!env.VERCEL_OIDC_TOKEN?.trim()) {
    throw new Error("S3 이미지 업로드에는 Vercel 빌드가 자동 제공하는 VERCEL_OIDC_TOKEN이 필요합니다. 로컬 검증은 IMAGE_ASSETS_MODE=local을 사용하세요.");
  }

  return {
    region,
    credentials: providerFactory({ roleArn }),
  };
}
