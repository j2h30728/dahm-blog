import type { Post } from "./posts";

export interface RelatedPostScore {
  post: Post;
  score: number;
  reasons: string[];
}

export function getRelatedPosts(current: Post, posts: Post[], limit = 4): RelatedPostScore[] {
  const scored = posts
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate) => scoreRelatedPost(current, candidate))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.post.data.date.valueOf() - a.post.data.date.valueOf();
    });

  const meaningful = scored.filter((item) => item.score > 0);
  if (meaningful.length >= limit) {
    return meaningful.slice(0, limit);
  }

  const fallback = scored
    .filter((item) => item.score === 0)
    .slice(0, Math.max(0, limit - meaningful.length))
    .map((item) => ({
      ...item,
      reasons: ["recent post"],
    }));

  return [...meaningful, ...fallback];
}

function scoreRelatedPost(current: Post, candidate: Post): RelatedPostScore {
  const reasons: string[] = [];
  let score = 0;

  if (candidate.data.series === current.data.series) {
    score += 100;
    reasons.push("same series");
  }

  const currentTags = new Set(current.data.tags);
  const overlappingTags = candidate.data.tags.filter((tag) => currentTags.has(tag));
  if (overlappingTags.length > 0) {
    score += overlappingTags.length * 10;
    reasons.push(`${overlappingTags.length} shared tag${overlappingTags.length > 1 ? "s" : ""}`);
  }

  return { post: candidate, score, reasons };
}
