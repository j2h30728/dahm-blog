"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { FormEvent, MouseEvent } from "react";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ui } from "../lib/ui-classes";
import { ThemeToggle } from "./ThemeToggle";
import { getArchiveHref, getArchivePath, getNavigationSection, postCategories, type NavigationSection, type PostCategory } from "../lib/archive";

const navItems = [
  ...postCategories.map(({ value, label }) => ({ href: getArchivePath(value), label, section: value })),
  { href: "/about/", label: "소개", section: "about" },
];

interface SiteHeaderProps {
  postCategories: Record<string, PostCategory>;
}

function NavigationLinks({ activeSection, onNavigate }: { activeSection: NavigationSection; onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <div className={ui.navLinks}>
      {navItems.map((item) => {
        const active = activeSection === item.section;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`${ui.navLink} ${active ? ui.navLinkActive : ui.navLinkInactive}`}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function NavigationFromUrl({ pathname, postCategories, onNavigate }: SiteHeaderProps & { pathname: string; onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const params = useSearchParams();
  return <NavigationLinks activeSection={getNavigationSection(pathname, postCategories, params.get("category"))} onNavigate={onNavigate} />;
}

export function SiteHeader({ postCategories }: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const resetHomeOnArrival = useRef(false);
  const activeSection = getNavigationSection(pathname, postCategories);
  const searchPath = pathname.replace(/\/+$/, "") === "/posts"
    ? "/posts/"
    : getArchivePath(activeSection === "tech" || activeSection === "life" ? activeSection : "all");

  const resetSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
  };

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    resetHomeOnArrival.current = false;
    resetSearch();
    const target = new URL(event.currentTarget.href);
    // 같은 목록 안의 검색 초기화는 문서 이동 없이 URL 상태만 갱신한다.
    if (window.location.pathname === target.pathname && window.location.search !== target.search) {
      event.preventDefault();
      window.history.pushState(null, "", target.href);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const handleHomeNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    resetSearch();
    resetHomeOnArrival.current = true;
    if (window.location.pathname === "/") {
      event.preventDefault();
      resetHomeOnArrival.current = false;
      if (window.location.search || window.location.hash) window.history.pushState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  useLayoutEffect(() => {
    if (pathname !== "/" || !resetHomeOnArrival.current) return;
    resetHomeOnArrival.current = false;
    // 정적 홈이 이전 검색 URL로 복원되어도 이번 로고 이동의 목적지는 항상 전체 홈이다.
    if (window.location.search || window.location.hash) window.history.replaceState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  useEffect(() => {
    const cancelHomeReset = () => { resetHomeOnArrival.current = false; };
    window.addEventListener("popstate", cancelHomeReset);
    return () => window.removeEventListener("popstate", cancelHomeReset);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setSearchValue("");
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const openSearch = () => {
    const params = new URLSearchParams(window.location.search);
    setSearchValue(params.get("q") ?? "");
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
    searchButtonRef.current?.focus();
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q");
    window.location.assign(getArchiveHref(window.location.search, { q: typeof query === "string" ? query : "" }, searchPath));
  };

  return (
    <header className={ui.siteHeader}>
      <nav aria-label="메인 메뉴" className={ui.nav}>
        <Link className={ui.brand} href="/" onClick={handleHomeNavigation}>
          Dahm
        </Link>
        <Suspense fallback={<NavigationLinks activeSection={activeSection} onNavigate={handleNavigation} />}>
          <NavigationFromUrl pathname={pathname} postCategories={postCategories} onNavigate={handleNavigation} />
        </Suspense>
        <div className={ui.navActions}>
          <button
            aria-controls="site-search"
            aria-expanded={searchOpen}
            aria-label={searchOpen ? "검색 닫기" : "글 검색"}
            className={ui.navIconButton}
            onClick={searchOpen ? closeSearch : openSearch}
            ref={searchButtonRef}
            title={searchOpen ? "검색 닫기" : "글 검색"}
            type="button"
          >
            {searchOpen ? (
              <svg
                aria-hidden="true"
                fill="none"
                height="17"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="17"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                fill="none"
                height="17"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="17"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            )}
          </button>
          <ThemeToggle />
        </div>
        <form
          action={searchPath}
          aria-hidden={!searchOpen}
          className={`${ui.navSearchForm} ${searchOpen ? ui.navSearchFormOpen : ui.navSearchFormClosed}`.trim()}
          method="get"
          onSubmit={handleSearchSubmit}
        >
          <label className={ui.searchLabel} htmlFor="site-search">글 검색</label>
          <input
            className={ui.navSearchField}
            id="site-search"
            name="q"
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeSearch();
              }
            }}
            placeholder="글 검색"
            ref={searchInputRef}
            tabIndex={searchOpen ? 0 : -1}
            type="search"
            value={searchValue}
          />
        </form>
      </nav>
    </header>
  );
}
