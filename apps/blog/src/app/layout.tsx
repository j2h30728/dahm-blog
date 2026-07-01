import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "../components/SiteHeader";
import { ui } from "../lib/ui-classes";

const siteDescription = "담의 글과 기록을 모아둔 공간입니다.";

export const metadata: Metadata = {
  title: {
    default: "Dahm",
    template: "%s | Dahm",
  },
  description: siteDescription,
  alternates: {
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
      </head>
      <body>
        <SiteHeader />
        <main className={ui.shell}>{children}</main>
        <footer className={ui.siteFooter}>
          <div className={ui.footerInner}>
            <div>
              <span className={ui.footerBrand}>Dahm</span>
              <p className={ui.footerMeta}>글과 선택의 기록.</p>
            </div>
            <nav aria-label="Footer" className={ui.footerLinks}>
              <Link className={ui.footerLink} href="/rss.xml">
                RSS
              </Link>
              <a className={ui.footerLink} href="https://github.com/j2h30728">
                GitHub
              </a>
              <a className={ui.footerLink} href="mailto:rachel2148072@gmail.com">
                Email
              </a>
            </nav>
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: typewriterScript }} />
      </body>
    </html>
  );
}

const initialThemeScript = `
const _s = localStorage.getItem('theme');
document.documentElement.dataset.theme =
  _s === 'dark' || _s === 'light' ? _s
  : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
`;

const typewriterScript = `
(() => {
  const el = document.querySelector('.typewriter');
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('done');
    return;
  }
  const text = el.textContent.trim();
  el.textContent = '';
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(type, 58);
    } else {
      el.classList.add('done');
    }
  }
  setTimeout(type, 350);
})();
`;
