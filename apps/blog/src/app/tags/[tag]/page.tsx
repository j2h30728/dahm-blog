import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "../../../components/PostList";
import { getPublishedPosts, getTagEntries, getTagEntryBySlug } from "../../../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../../../lib/site";
import { ui } from "../../../lib/ui-classes";

interface PageProps {
  params: Promise<{
    tag: string;
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getTagEntries(getPublishedPosts()).map((entry) => ({ tag: entry.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
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
  const { tag } = await params;
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
