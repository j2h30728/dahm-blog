"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GiscusConfig } from "../lib/comments";

function LoadingComments() {
  return <p className="m-0 text-sm text-muted-strong" role="status">댓글을 불러오는 중…</p>;
}

const Giscus = dynamic(() => import("@giscus/react"), {
  ssr: false,
  loading: LoadingComments,
});

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerTheme() {
  return "light" as const;
}

export function PostComments({ slug, config }: { slug: string; config: GiscusConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby="comments-title" className="mt-14 w-full max-w-[768px] border-t border-line pt-8 max-[1119px]:mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[1.125rem] font-semibold text-ink" id="comments-title">댓글</h2>
        <a
          className="interaction-overlay rounded-[var(--radius-sm)] px-2 py-1 text-sm text-muted-strong hover:no-underline"
          href={`https://github.com/${config.repo}/discussions`}
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub에서 보기
        </a>
      </div>
      <p className="mb-0 mt-3 text-sm leading-relaxed text-muted-strong">GitHub 계정으로 댓글과 반응을 남길 수 있어요.</p>
      <div className="mt-6 min-h-[300px]" ref={containerRef}>
        {ready ? (
          <Giscus
            category={config.category}
            categoryId={config.categoryId}
            emitMetadata="0"
            inputPosition="top"
            lang="ko"
            loading="lazy"
            mapping="specific"
            reactionsEnabled="1"
            repo={config.repo}
            repoId={config.repoId}
            strict="1"
            term={`post:${slug}`}
            theme={theme}
          />
        ) : <LoadingComments />}
      </div>
    </section>
  );
}
