import assert from "node:assert/strict";
import { test } from "node:test";
import { getRelatedPosts } from "../src/lib/related-posts";

function post(id: string, series: string, tags: string[], date: string) {
  return {
    id,
    data: {
      title: id,
      slug: id,
      description: id,
      date: new Date(date),
      tags,
      series,
      published: true,
    },
  } as never;
}

test("related posts prioritize same series, then tag overlap, and never include self", () => {
  const current = post("current", "Series A", ["astro", "obsidian"], "2026-06-23");
  const sameSeries = post("same-series", "Series A", ["other"], "2026-06-24");
  const sharedTags = post("shared-tags", "Series B", ["astro", "obsidian"], "2026-06-25");
  const unrelated = post("unrelated", "Series B", ["none"], "2026-06-26");

  const related = getRelatedPosts(current, [current, sharedTags, unrelated, sameSeries]);

  assert.equal(related.length, 3);
  assert.equal(related[0].post.id, "same-series");
  assert.equal(related[1].post.id, "shared-tags");
  assert.equal(related[2].post.id, "unrelated");
  assert.deepEqual(related[2].reasons, ["recent post"]);
});
