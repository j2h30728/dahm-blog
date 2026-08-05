export function formatWarningSummary(warningCount: number, manifestPath: string): string {
  return `${warningCount} warning(s). Manifest path: ${manifestPath}`;
}

export function formatManifestPath(manifestPath: string): string {
  return `Manifest path: ${manifestPath}`;
}

export function formatBlockingErrors(errors: string[]): string {
  const header = `Content sync failed with ${errors.length} blocking error(s):`;
  const lines = errors.map((error, index) => `  ${index + 1}. ${error}`);
  return [header, ...lines].join("\n");
}
