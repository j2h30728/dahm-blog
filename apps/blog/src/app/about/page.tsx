import type { Metadata } from "next";
import { absoluteUrl, canonicalPath, siteConfig } from "../../lib/site";
import { ui } from "../../lib/ui-classes";

const description = "담을 소개하는 페이지입니다.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: {
    canonical: canonicalPath("/about/"),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/about/"),
    title: `About ${siteConfig.name}`,
    description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: `About ${siteConfig.name}`,
    description,
  },
};

export default function AboutPage() {
  return (
    <section aria-labelledby="about-title" className={ui.homeIntro} id="about">
      <div className={ui.minWidthZero}>
        <p className={ui.tagline}>About</p>
        <h1 className={ui.homeTitle} id="about-title">
          안녕하세요. 담입니다.
        </h1>
        <div className={ui.aboutCopy}>
          <p>프론트엔드 개발자 이지현입니다.</p>
          <p>
            사용자에게 자연스러운 화면과 오래 다루기 좋은 구조를 고민합니다.
          </p>
          <p>
            이곳에는 개발하며 배운 것, 선택의 이유, 프론트엔드 설계와 작업 과정
            등에 대한 기록을 남깁니다.
          </p>
        </div>
      </div>
      <div aria-label="Profile links" className={ui.homeSummary}>
        <a className={ui.summaryPill} href="https://github.com/j2h30728">
          GitHub
        </a>
        <a className={ui.summaryPill} href="mailto:rachel2148072@gmail.com">
          Email
        </a>
        <a className={ui.summaryPill} href="https://velog.io/@rachel28/posts">
          Velog
        </a>
      </div>
    </section>
  );
}
