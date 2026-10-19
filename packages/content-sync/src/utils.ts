export function slugify(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/['"]/g, "")
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

export function slugifyHeading(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/[^\p{Letter}\p{Number}\p{Mark} _-]+/gu, "").replace(/ /g, "-");
}

export function plainText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*`{3,}.*$/gm, "").replace(/<[^>]*>/g, "")
    .replace(/[`*~]/g, "").replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity]!)
    .replace(/\s+/g, " ").trim();
}
