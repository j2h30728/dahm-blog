import type { Metadata } from "next";
import { PostsSection } from "../../components/PostsSection";
import { getPublishedPosts } from "../../lib/posts";
import { absoluteUrl, siteConfig } from "../../lib/site";

export const indexMetadata: Metadata = {
  title: "기술",
  description: siteConfig.description,
  alternates: {
    canonical: "/tech/",
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/tech/"),
    title: `${siteConfig.name} 기술`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} 기술`,
    description: siteConfig.description,
  },
};

export default function PostsPage() {
  const posts = getPublishedPosts();
  return <PostsSection posts={posts} />;
}
