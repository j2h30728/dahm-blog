import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Json = Record<string, unknown>;

const template = JSON.parse(
  readFileSync(new URL("../../../infra/image-cdn.json", import.meta.url), "utf8"),
) as Json;
const resources = template.Resources as Record<string, Json>;
const outputs = template.Outputs as Record<string, Json>;

test("Vercel 팀 OIDC 공급자를 새로 만들거나 같은 팀의 기존 공급자만 재사용한다", () => {
  const parameter = (template.Parameters as Record<string, Json>).ExistingOidcProviderArn;
  assert.equal(parameter.Default, "");
  const pattern = new RegExp(String(parameter.AllowedPattern));
  assert.equal(pattern.test(""), true);
  assert.equal(pattern.test("arn:aws:iam::123456789012:oidc-provider/oidc.vercel.com/j2h30728s-projects"), true);
  assert.equal(pattern.test("arn:aws:iam::123456789012:oidc-provider/oidc.vercel.com/other-team"), false);
  assert.equal(pattern.test("arn:aws:iam::123456789012:role/not-an-oidc-provider"), false);

  assert.deepEqual((template.Conditions as Json).CreateOidcProvider, {
    "Fn::Equals": [{ Ref: "ExistingOidcProviderArn" }, ""],
  });
  assert.equal(resources.VercelOidcProvider.Condition, "CreateOidcProvider");
  assert.equal(resources.VercelOidcProvider.DeletionPolicy, "Retain", "공급자 재사용 경로로 바뀌어도 계정의 공유 공급자를 삭제하지 않는다");
  assert.equal(resources.VercelOidcProvider.UpdateReplacePolicy, "Retain");
  assert.deepEqual(resources.VercelOidcProvider.Properties, {
    Url: "https://oidc.vercel.com/j2h30728s-projects",
    ClientIdList: ["https://vercel.com/j2h30728s-projects"],
    Tags: [{ Key: "Project", Value: "dahm-blog" }],
  });

  const providerChoice = {
    "Fn::If": [
      "CreateOidcProvider",
      { Ref: "VercelOidcProvider" },
      { Ref: "ExistingOidcProviderArn" },
    ],
  };
  const role = resources.ImageUploaderRole.Properties as Json;
  const trust = role.AssumeRolePolicyDocument as Json;
  const statement = (trust.Statement as Json[])[0];
  assert.deepEqual((statement.Principal as Json).Federated, providerChoice);
  assert.deepEqual(outputs.OidcProviderArn.Value, providerChoice);
});

test("OIDC 역할은 dahm-blog Production 배포만 신뢰하고 업로더 정책 하나만 연결한다", () => {
  const role = resources.ImageUploaderRole.Properties as Json;
  assert.equal(role.RoleName, undefined, "역할 이름은 CloudFormation이 충돌 없이 생성해야 한다");
  assert.equal(role.MaxSessionDuration, 3600);
  assert.deepEqual(role.ManagedPolicyArns, [{ Ref: "ImageUploaderPolicy" }]);

  const trust = role.AssumeRolePolicyDocument as Json;
  const statement = (trust.Statement as Json[])[0];
  assert.equal(statement.Action, "sts:AssumeRoleWithWebIdentity");
  assert.equal(statement.Effect, "Allow");
  assert.deepEqual(statement.Condition, {
    StringEquals: {
      "oidc.vercel.com/j2h30728s-projects:aud": "https://vercel.com/j2h30728s-projects",
      "oidc.vercel.com/j2h30728s-projects:sub": "owner:j2h30728s-projects:project:dahm-blog:environment:production",
    },
  });
  assert.equal(JSON.stringify(statement.Condition).includes("preview"), false);
  assert.equal(JSON.stringify(statement.Condition).includes("project:*"), false);
  assert.deepEqual(outputs.AwsRoleArn.Value, { "Fn::GetAtt": ["ImageUploaderRole", "Arn"] });
});

test("업로더는 전용 이미지 prefix를 읽고 쓸 수 있지만 삭제할 수 없다", () => {
  const policy = resources.ImageUploaderPolicy.Properties as Json;
  const document = policy.PolicyDocument as Json;
  const statements = document.Statement as Json[];
  const objectAccess = statements.find((statement) => Array.isArray(statement.Action));
  assert.ok(objectAccess);
  assert.deepEqual(objectAccess.Action, ["s3:GetObject", "s3:PutObject"]);
  assert.deepEqual(objectAccess.Resource, { "Fn::Sub": "${ImageBucket.Arn}/blog-images/*" });

  const allowedActions = statements.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action]);
  assert.equal(allowedActions.some((action) => String(action).includes("Delete")), false);
  assert.equal(allowedActions.some((action) => String(action).includes("iam:")), false);

  assert.equal(resources.ImageBucket.DeletionPolicy, "Retain");
  assert.equal(resources.ImageBucket.UpdateReplacePolicy, "Retain");
});
