import type { Metadata } from "next";
import PostsIndex, { indexMetadata } from "../index-view";
import { notFound } from "next/navigation";
import { Backlinks } from "../../../components/Backlinks";
import { PostEnhancements } from "../../../components/PostEnhancements";
import { RelatedPosts } from "../../../components/RelatedPosts";
import { Toc } from "../../../components/Toc";
import { allPostSlugs, formatPostDate, getPost, getPostContent, getPublishedPosts } from "../../../lib/posts";
import { getBacklinks, getLinkPreviewPayload } from "../../../lib/public-link-index";
import { getRelatedPosts } from "../../../lib/related-posts";
import { absoluteUrl, canonicalPath, jsonLd, siteConfig } from "../../../lib/site";
import { ui } from "../../../lib/ui-classes";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: [] }, ...allPostSlugs.map((slug) => ({ slug: [slug] }))];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const segments = (await params).slug ?? [];
  if (segments.length === 0) return indexMetadata;
  if (segments.length !== 1) return {};
  const slug = segments[0];
  const post = getPost(slug);
  if (!post) return {};

  const publishedTime = new Date(post.date).toISOString();
  const modifiedTime = new Date(post.updated ?? post.date).toISOString();

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: canonicalPath(post.href),
    },
    openGraph: {
      type: "article",
      url: absoluteUrl(post.href),
      title: post.title,
      description: post.description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      publishedTime,
      modifiedTime,
      authors: [siteConfig.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const segments = (await params).slug ?? [];
  if (segments.length === 0) return <PostsIndex />;
  if (segments.length !== 1) notFound();
  const slug = segments[0];
  const post = getPost(slug);
  const postModule = await getPostContent(slug);
  if (!post || !postModule) notFound();

  const Content = postModule.default;
  const related = getRelatedPosts(post, getPublishedPosts());
  const backlinks = getBacklinks(post.slug);
  const previewPayload = getLinkPreviewPayload();
  const postUrl = absoluteUrl(post.href);
  const postJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: new Date(post.date).toISOString(),
    dateModified: new Date(post.updated ?? post.date).toISOString(),
    author: [
      {
        "@type": "Person",
        name: siteConfig.author,
        url: siteConfig.authorUrl,
      },
    ],
    publisher: {
      "@type": "Person",
      name: siteConfig.author,
      url: siteConfig.authorUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    url: postUrl,
    keywords: post.tags,
    articleSection: post.topic,
    inLanguage: siteConfig.language,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(postJsonLd) }}
      />
      {post.series ? (
        <p className={ui.tagline}>
          <span className="typewriter">{post.series}</span>
        </p>
      ) : null}
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
