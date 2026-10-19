import type { Metadata } from "next";
import TagsIndex, { indexMetadata } from "../index-view";
import { notFound } from "next/navigation";
import { PostList } from "../../../components/PostList";
import { getPublishedPosts, getTagEntries, getTagEntryBySlug } from "../../../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../../../lib/site";
import { ui } from "../../../lib/ui-classes";

interface PageProps {
  params: Promise<{
    tag?: string[];
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ tag: [] }, ...getTagEntries(getPublishedPosts()).map((entry) => ({ tag: [entry.slug] }))];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const segments = (await params).tag ?? [];
  if (segments.length === 0) return indexMetadata;
  if (segments.length !== 1) return {};
  const tag = segments[0];
  const entry = getTagEntryBySlug(tag);
  if (!entry) return {};

  const title = `Tag: ${entry.name}`;
  const description = `${entry.name} 태그의 글 ${entry.posts.length}개를 모아둔 페이지입니다.`;
  const url = `/tags/${entry.slug}/`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath(url),
    },
    openGraph: {
      type: "website",
      url: absoluteUrl(url),
      title,
      description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function TagDetailPage({ params }: PageProps) {
  const segments = (await params).tag ?? [];
  if (segments.length === 0) return <TagsIndex />;
  if (segments.length !== 1) notFound();
  const tag = segments[0];
  const entry = getTagEntryBySlug(tag);
  if (!entry) notFound();

  return (
    <>
      <p className={ui.tagline}>Tag</p>
      <h1 className={ui.pageTitle}>{entry.name}</h1>
      <PostList posts={entry.posts} />
    </>
  );
}
