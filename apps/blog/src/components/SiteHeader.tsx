"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ui } from "../lib/ui-classes";
import { ThemeToggle } from "./ThemeToggle";
import { getArchiveHref } from "../lib/archive";

const navItems = [
  { href: "/posts/", label: "글", match: (pathname: string) => pathname === "/" || pathname.startsWith("/posts") },
  { href: "/about/", label: "소개", match: (pathname: string) => pathname.startsWith("/about") },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

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
    window.location.assign(getArchiveHref(window.location.search, { q: typeof query === "string" ? query : "" }));
  };

  return (
    <header className={ui.siteHeader}>
      <nav aria-label="메인 메뉴" className={ui.nav}>
        <Link className={ui.brand} href="/posts/">
          Dahm
        </Link>
        <div className={ui.navLinks}>
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`${ui.navLink} ${active ? ui.navLinkActive : ui.navLinkInactive}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
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
          action="/posts/"
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
            placeholder="현재 분류에서 검색"
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
