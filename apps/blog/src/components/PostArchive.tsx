"use client";

import { useMemo, useState } from "react";
import type { Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";
import { PostList } from "./PostList";

interface ArchiveEntry {
  count: number;
  name: string;
  slug?: string;
}

interface PostArchiveProps {
  posts: Post[];
  series: ArchiveEntry[];
  tags: ArchiveEntry[];
}

export function PostArchive({ posts, series, tags }: PostArchiveProps) {
  const [query, setQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [post.title, post.description, post.excerpt, post.series, ...post.tags]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesSeries = selectedSeries.length === 0 || post.series === selectedSeries;
        const matchesTag = selectedTag.length === 0 || post.tags.includes(selectedTag);
        return matchesQuery && matchesSeries && matchesTag;
      }),
    [normalizedQuery, posts, selectedSeries, selectedTag],
  );

  const hasFilter = normalizedQuery.length > 0 || selectedSeries.length > 0 || selectedTag.length > 0;
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
        <label className={ui.searchLabel} htmlFor="post-search">
          Search posts
        </label>
        <input
          className={ui.searchBox}
          id="post-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search posts"
          type="search"
          value={query}
        />

        <div className={ui.filterGrid}>
          <FilterGroup
            entries={series}
            label="Series"
            onSelect={setSelectedSeries}
            selected={selectedSeries}
          />
          <FilterGroup entries={tags} label="Tags" onSelect={setSelectedTag} selected={selectedTag} />
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
