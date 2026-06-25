import { formatManifestPath, formatWarningSummary } from "./cli-output.js";
import { parseCliArgs } from "./cli-options.js";
import { transformVault } from "./transform.js";

const args = parseCliArgs(process.argv.slice(2));

try {
  const manifest = transformVault(args);
  console.log(`Exported ${manifest.exportedPosts.length} post(s).`);
  if (manifest.warnings.length > 0) {
    console.warn(formatWarningSummary(manifest.warnings.length, args.manifestPath));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(formatManifestPath(args.manifestPath));
  process.exitCode = 1;
}
