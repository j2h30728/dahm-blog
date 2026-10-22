import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MANIFEST_PATH = fileURLToPath(new URL("../content/image-manifest.json", import.meta.url));
const VALID_MODES = new Set(["off", "local", "s3"]);
const DEFAULT_SIZES = "(max-width: 768px) calc(100vw - 2rem), 768px";

function readManifest(path, mode) {
  if (!existsSync(path)) {
    if (mode === "off") return { version: 1, images: {} };
    throw new Error(`이미지 자산 모드 ${mode}에는 manifest가 필요합니다: ${path}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`이미지 manifest를 읽을 수 없습니다: ${path}`, { cause: error });
  }

  if (manifest?.version !== 1 || !manifest.images || typeof manifest.images !== "object" || Array.isArray(manifest.images)) {
    throw new Error(`지원하지 않는 이미지 manifest 형식입니다: ${path}`);
  }
  return manifest;
}

function validateAsset(asset, source) {
  const positiveInteger = (value) => Number.isInteger(value) && value > 0;
  if (
    !asset ||
    typeof asset.src !== "string" ||
    typeof asset.originalSrc !== "string" ||
    !positiveInteger(asset.width) ||
    !positiveInteger(asset.height) ||
    !positiveInteger(asset.originalWidth) ||
    !positiveInteger(asset.originalHeight) ||
    !Array.isArray(asset.variants) ||
    asset.variants.length === 0 ||
    asset.variants.some((variant) => typeof variant?.src !== "string" || !positiveInteger(variant.width))
  ) {
    throw new Error(`이미지 manifest 항목이 올바르지 않습니다: ${source}`);
  }
}

function visitImages(node, visit) {
  if (!node || typeof node !== "object") return;
  if (node.type === "element" && node.tagName === "img") visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visitImages(child, visit);
  }
}

export default function rehypePostImages(options = {}) {
  const mode = options.mode ?? process.env.IMAGE_ASSETS_MODE ?? "off";
  if (!VALID_MODES.has(mode)) throw new Error(`지원하지 않는 IMAGE_ASSETS_MODE입니다: ${mode}`);

  return (tree) => {
    const manifest = options.manifest ?? readManifest(options.manifestPath ?? MANIFEST_PATH, mode);
    if (manifest?.version !== 1 || !manifest.images || typeof manifest.images !== "object") {
      throw new Error("지원하지 않는 이미지 manifest 형식입니다.");
    }

    visitImages(tree, (node) => {
      const source = node.properties?.src;
      if (typeof source !== "string" || source.length === 0) return;

      const asset = manifest.images[source];
      if (!asset) {
        if (mode !== "off") throw new Error(`이미지 manifest에 본문 이미지가 없습니다: ${source}`);
        return;
      }

      validateAsset(asset, source);
      const variants = [...asset.variants]
        .sort((left, right) => left.width - right.width)
        .filter((variant, index, items) => index === 0 || variant.width !== items[index - 1].width);

      node.properties = {
        ...node.properties,
        src: asset.src,
        srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(", "),
        sizes: DEFAULT_SIZES,
        width: asset.width,
        height: asset.height,
        loading: "lazy",
        decoding: "async",
        "data-original-src": asset.originalSrc,
        "data-original-width": asset.originalWidth,
        "data-original-height": asset.originalHeight,
      };
    });
  };
}

