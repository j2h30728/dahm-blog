import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const expectedNode = packageJson.volta?.node;
const expectedNodeMajor = expectedNode?.split(".")[0];
const expectedPackageManager = packageJson.packageManager;
const failures = [];

if (expectedNodeMajor && process.versions.node.split(".")[0] !== expectedNodeMajor) {
  failures.push(
    `Node ${process.versions.node} is active; expected Node ${expectedNode}. Run "nvm use" or put Volta before nvm in PATH.`,
  );
}

const userAgent = process.env.npm_config_user_agent ?? "";

if (userAgent && expectedPackageManager) {
  const [expectedName, expectedVersion] = expectedPackageManager.split("@");
  const packageManagerMatch = userAgent.match(/(?:^|\s)(bun|npm|pnpm|yarn)\/([^\s]+)/);

  if (!packageManagerMatch) {
    failures.push(`Could not detect the package manager from npm_config_user_agent="${userAgent}".`);
  } else {
    const [, actualName, actualVersion] = packageManagerMatch;

    if (actualName !== expectedName || actualVersion !== expectedVersion) {
      failures.push(
        `Package manager ${actualName}@${actualVersion} is active; expected ${expectedPackageManager}.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Environment mismatch:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}
