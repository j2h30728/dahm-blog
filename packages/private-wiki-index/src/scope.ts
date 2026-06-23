import path from "node:path";

export interface ScopeConfig {
  vaultRoot: string;
  include: string[];
  exclude?: string[];
}

export function resolveScope(config: ScopeConfig): {
  includeRoots: string[];
  excludeRoots: string[];
} {
  const vaultRoot = path.resolve(config.vaultRoot);
  return {
    includeRoots: config.include.map((entry) => path.resolve(vaultRoot, entry)),
    excludeRoots: (config.exclude ?? []).map((entry) => path.resolve(vaultRoot, entry)),
  };
}

export function isAllowedPath(filePath: string, includeRoots: string[], excludeRoots: string[]): boolean {
  const absolutePath = path.resolve(filePath);
  const included = includeRoots.some((root) => isWithin(root, absolutePath));
  const excluded = excludeRoots.some((root) => isWithin(root, absolutePath));
  return included && !excluded;
}

export function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
