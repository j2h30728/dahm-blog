import type { Metadata } from "next";
import { ui } from "../../lib/ui-classes";

export const metadata: Metadata = {
  title: "About",
  description: "담을 소개하는 페이지입니다.",
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
          <p>프론트엔드 개발을 하며 화면 뒤의 구조와 팀의 규칙을 함께 살핍니다.</p>
          <p>이곳에는 일하면서 마주친 문제와 선택의 이유를 제 언어로 정리합니다.</p>
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
