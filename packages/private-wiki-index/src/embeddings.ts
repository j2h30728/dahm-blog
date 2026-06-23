import { createHash } from "node:crypto";

export interface LocalEmbedding {
  provider: "local-hash";
  dimensions: number;
  vector: number[];
}

export function createLocalEmbedding(text: string, dimensions = 64): LocalEmbedding {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest[0] % dimensions;
    const sign = digest[1] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.hypot(...vector) || 1;
  return {
    provider: "local-hash",
    dimensions,
    vector: vector.map((value) => Number((value / norm).toFixed(6))),
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return dot / ((Math.sqrt(normA) || 1) * (Math.sqrt(normB) || 1));
}
