import { existsSync } from "node:fs";
import path from "node:path";

export function loadWorkspaceEnv(root: string): void {
  // 이미 설정된 process.env를 덮어쓰지 않는다.
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
