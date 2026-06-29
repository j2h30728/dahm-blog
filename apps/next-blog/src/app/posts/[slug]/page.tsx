import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Backlinks } from "../../../components/Backlinks";
import { PostEnhancements } from "../../../components/PostEnhancements";
import { RelatedPosts } from "../../../components/RelatedPosts";
import { Toc } from "../../../components/Toc";
import { allPostSlugs, formatPostDate, getPost, getPostContent, getPublishedPosts } from "../../../lib/posts";
import { getBacklinks, getLinkPreviewPayload } from "../../../lib/public-link-index";
import { getRelatedPosts } from "../../../lib/related-posts";
import { ui } from "../../../lib/ui-classes";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return allPostSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  const postModule = await getPostContent(slug);
  if (!post || !postModule) notFound();

  const Content = postModule.default;
  const related = getRelatedPosts(post, getPublishedPosts());
  const backlinks = getBacklinks(post.slug);
  const previewPayload = getLinkPreviewPayload();

  return (
    <article>
      <p className={ui.tagline}>
        <span className="typewriter">{post.series}</span>
      </p>
      <h1 className={ui.pageTitle}>{post.title}</h1>
      <div className={ui.meta}>
        <time dateTime={new Date(post.date).toISOString()}>{formatPostDate(post.date)}</time>
      </div>
      <div className={ui.postLayout}>
        <div className={ui.contentPanel}>
          <Content />
        </div>
        <Toc headings={post.headings} />
      </div>
      <RelatedPosts related={related} />
      <Backlinks backlinks={backlinks} />
      <PostEnhancements previews={previewPayload} />
    </article>
  );
}
