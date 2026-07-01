"use client";

import { useEffect, useMemo, useState } from "react";
import type { Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";
import { PostList } from "./PostList";

interface ArchiveEntry {
  count: number;
  name: string;
}

interface PostArchiveProps {
  posts: Post[];
  topics: ArchiveEntry[];
}

export function PostArchive({ posts, topics }: PostArchiveProps) {
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("q")?.trim() ?? "");
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [post.title, post.description, post.excerpt, post.topic, post.series, ...post.tags]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesTopic = selectedTopic.length === 0 || post.topic === selectedTopic;
        return matchesQuery && matchesTopic;
      }),
    [normalizedQuery, posts, selectedTopic],
  );

  const hasFilter = normalizedQuery.length > 0 || selectedTopic.length > 0;
  const meta = hasFilter ? `${filteredPosts.length} / ${posts.length} posts` : `${posts.length} posts`;

  return (
    <section aria-labelledby="posts-title" className={ui.pageSection} id="posts">
      <div className={ui.sectionHeading}>
        <div>
          <p className={ui.tagline}>Posts</p>
          <h1 className={ui.sectionTitle} id="posts-title">
            Posts
          </h1>
        </div>
        <p className={ui.sectionMeta}>{meta}</p>
      </div>

      <div className={ui.archiveTools}>
        {query.length > 0 ? (
          <div className={ui.activeSearch}>
            <span className={ui.activeSearchLabel}>Search: {query}</span>
            <a className={ui.activeSearchClear} href="/posts/">
              Clear
            </a>
          </div>
        ) : null}

        <div className={ui.filterGrid}>
          <FilterGroup
            entries={topics}
            label="Topics"
            onSelect={setSelectedTopic}
            selected={selectedTopic}
          />
        </div>
      </div>

      {filteredPosts.length > 0 ? (
        <PostList posts={filteredPosts} />
      ) : (
        <p className={ui.emptyState}>No matching posts.</p>
      )}
    </section>
  );
}

function FilterGroup({
  entries,
  label,
  onSelect,
  selected,
}: {
  entries: ArchiveEntry[];
  label: string;
  onSelect: (value: string) => void;
  selected: string;
}) {
  return (
    <div className={ui.filterGroup}>
      <p className={ui.filterLabel}>{label}</p>
      <div className={ui.filterList}>
        <button
          className={`${ui.filterPill} ${selected.length === 0 ? ui.filterPillActive : ""}`.trim()}
          onClick={() => onSelect("")}
          type="button"
        >
          All
        </button>
        {entries.map((entry) => (
          <button
            className={`${ui.filterPill} ${selected === entry.name ? ui.filterPillActive : ""}`.trim()}
            key={entry.name}
            onClick={() => onSelect(entry.name)}
            type="button"
          >
            {entry.name}
            <span className={ui.filterCount}>{entry.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
