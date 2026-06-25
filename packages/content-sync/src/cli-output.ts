export function formatWarningSummary(warningCount: number, manifestPath: string): string {
  return `${warningCount} warning(s). Manifest path: ${manifestPath}`;
}

export function formatManifestPath(manifestPath: string): string {
  return `Manifest path: ${manifestPath}`;
}
