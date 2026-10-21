"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { filterArchivePosts, getArchiveCategory, getArchiveHref, postCategories, type PostCategory } from "../lib/archive";
import type { Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";
import { PostList } from "./PostList";

interface PostArchiveProps {
  posts: Post[];
}

export function PostArchive({ posts }: PostArchiveProps) {
  return (
    <Suspense fallback={<ArchiveContent posts={posts} category="tech" query="" search="" />}>
      <ArchiveFromUrl posts={posts} />
    </Suspense>
  );
}

function ArchiveFromUrl({ posts }: PostArchiveProps) {
  const params = useSearchParams();

  return (
    <ArchiveContent
      posts={posts}
      category={getArchiveCategory(params.get("category"))}
      query={params.get("q")?.trim() ?? ""}
      search={params.toString()}
    />
  );
}

function ArchiveContent({ posts, category, query, search }: PostArchiveProps & {
  category: PostCategory;
  query: string;
  search: string;
}) {
  const filteredPosts = filterArchivePosts(posts, category, query);
  const categoryLabel = category === "tech" ? "기술" : "일상";

  return (
    <section aria-labelledby="posts-title" className={ui.archive} id="posts">
      <div className={ui.archiveIntro}>
        <h1 className={ui.archiveTitle} id="posts-title">글과 선택의 기록.</h1>
        <p className={ui.archiveSubtitle}>개발하며 배운 것과 일상에서 남긴 생각.</p>
      </div>

      <nav aria-label="글 분류" className={ui.archiveTabs}>
        {postCategories.map(({ value, label }) => (
          <a
            aria-current={category === value ? "page" : undefined}
            className={`${ui.archiveTab} ${category === value ? ui.archiveTabActive : ui.archiveTabInactive}`}
            href={getArchiveHref(search, { category: value })}
            key={value}
          >
            {label}
          </a>
        ))}
      </nav>

      {query ? (
        <div className={ui.activeSearch}>
          <span className={ui.activeSearchLabel}>검색: {query}</span>
          <a className={ui.activeSearchClear} href={getArchiveHref(search, { q: "" })}>
            검색 해제
          </a>
        </div>
      ) : null}

      <p className="sr-only" role="status">{categoryLabel} 글 {filteredPosts.length}개</p>
      {filteredPosts.length > 0 ? (
        <PostList posts={filteredPosts} />
      ) : (
        <p className={ui.emptyState}>
          {query ? "검색어에 해당하는 글이 없어요." : `아직 ${categoryLabel} 글이 없어요.`}
        </p>
      )}
    </section>
  );
}
