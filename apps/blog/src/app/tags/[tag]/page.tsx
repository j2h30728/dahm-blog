import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "../../../components/PostList";
import { getPublishedPosts, getTagEntries, getTagEntryBySlug } from "../../../lib/posts";
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

  return {
    title: `Tag: ${entry.name}`,
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
