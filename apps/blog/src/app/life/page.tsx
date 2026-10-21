import type { Metadata } from "next";
import { PostsSection } from "../../components/PostsSection";
import { getPublishedPosts } from "../../lib/posts";
import { absoluteUrl, siteConfig } from "../../lib/site";

const description = "일상에서 남긴 생각과 경험.";

export const metadata: Metadata = {
  title: "일상",
  description,
  alternates: { canonical: "/life/" },
  openGraph: {
    type: "website",
    url: absoluteUrl("/life/"),
    title: `${siteConfig.name} 일상`,
    description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: { card: "summary", title: `${siteConfig.name} 일상`, description },
};

export default function LifePage() {
  return <PostsSection posts={getPublishedPosts()} category="life" />;
}
