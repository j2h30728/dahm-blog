"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { filterArchivePosts, getArchiveCategory, getArchiveHref, getArchivePath, type ArchivePath, type ArchiveScope } from "../lib/archive";
import type { Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";
import { PostList } from "./PostList";

interface PostArchiveProps {
  posts: Post[];
  category?: ArchiveScope;
}

const archiveCopy = {
  all: { label: "전체", title: "글과 선택의 기록.", subtitle: "개발하며 배운 것과 일상에서 남긴 생각.", empty: "아직 작성된 글이 없어요." },
  tech: { label: "기술", title: "기술", subtitle: "개발하며 배운 것과 문제를 해결한 기록.", empty: "아직 기술 글이 없어요." },
  life: { label: "일상", title: "일상", subtitle: "일상에서 남긴 생각과 경험.", empty: "아직 일상 글이 없어요." },
};

export function PostArchive({ posts, category }: PostArchiveProps) {
  const pathname = category ? getArchivePath(category) : "/posts/";
  return (
    <Suspense fallback={<ArchiveContent posts={posts} category={category ?? "tech"} pathname={pathname} query="" search="" />}>
      <ArchiveFromUrl posts={posts} category={category} />
    </Suspense>
  );
}

function ArchiveFromUrl({ posts, category }: PostArchiveProps) {
  const params = useSearchParams();

  return (
    <ArchiveContent
      posts={posts}
      category={category ?? getArchiveCategory(params.get("category"))}
      pathname={category ? getArchivePath(category) : "/posts/"}
      query={params.get("q")?.trim() ?? ""}
      search={params.toString()}
    />
  );
}

function ArchiveContent({ posts, category, pathname, query, search }: PostArchiveProps & {
  category: ArchiveScope;
  pathname: ArchivePath;
  query: string;
  search: string;
}) {
  const filteredPosts = filterArchivePosts(posts, category, query);
  const copy = archiveCopy[category];

  return (
    <section aria-labelledby="posts-title" className={ui.archive} id="posts">
      <div className={ui.archiveIntro}>
        <h1 className={ui.archiveTitle} id="posts-title">{copy.title}</h1>
        <p className={ui.archiveSubtitle}>{copy.subtitle}</p>
      </div>

      {query ? (
        <div className={ui.activeSearch}>
          <span className={ui.activeSearchLabel}>검색: {query}</span>
          <a className={ui.activeSearchClear} href={getArchiveHref(search, { q: "" }, pathname)}>
            검색 해제
          </a>
        </div>
      ) : null}

      <p className="sr-only" role="status">{copy.label} 글 {filteredPosts.length}개</p>
      {filteredPosts.length > 0 ? (
        <PostList posts={filteredPosts} showCategory={category === "all"} />
      ) : (
        <p className={ui.emptyState}>
          {query ? "검색어에 해당하는 글이 없어요." : copy.empty}
        </p>
      )}
    </section>
  );
}
