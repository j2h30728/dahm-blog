const pageFrame = "mx-auto w-full max-w-[768px] px-6 max-[640px]:px-5";
const pageHeading = "text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-[1.35] tracking-[-0.02em] text-ink text-balance";

export const ui = {
  siteHeader:
    "sticky top-0 z-10 border-b border-header-border bg-header-bg",
  nav:
    `${pageFrame} relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] py-3 max-[640px]:gap-x-1 max-[640px]:py-2`,
  brand:
    "inline-flex min-w-0 items-center text-ink text-[1.5rem] font-bold max-[640px]:text-xl tracking-[-0.01em] transition-opacity duration-[160ms] hover:opacity-70 hover:no-underline",
  navLinks:
    "flex min-w-0 items-center justify-end gap-1 text-[0.9375rem] max-[640px]:gap-0 max-[640px]:text-[0.875rem]",
  navActions:
    "flex shrink-0 items-center justify-end gap-0.5",
  navLink:
    "interaction-overlay relative shrink-0 rounded-[var(--radius-sm)] px-2 py-2 transition-colors duration-[160ms] after:absolute after:inset-x-2 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-[180ms] after:content-[''] hover:no-underline max-[640px]:px-1 max-[640px]:after:inset-x-1",
  navLinkActive:
    "text-ink after:scale-x-100",
  navLinkInactive: "text-muted-strong",
  navSearchForm:
    "col-span-full row-start-2 min-w-0",
  navSearchFormOpen:
    "block w-full",
  navSearchFormClosed:
    "hidden",
  navSearchField:
    "h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-control-border bg-paper px-3 text-[0.95rem] text-ink placeholder:text-muted placeholder:opacity-100 transition-[border-color] duration-[160ms] focus:border-accent max-[640px]:text-base",
  navIconButton:
    "interaction-overlay group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-transparent bg-transparent p-0 text-muted-strong transition-colors duration-[160ms]",
  shell:
    `${pageFrame} flex-1 pb-20 pt-10 max-[640px]:pb-12 max-[640px]:pt-7`,
  siteFooter:
    "shrink-0",
  footerInner:
    `${pageFrame} grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--space-6)] border-t border-line py-8 text-[0.875rem] max-[640px]:grid-cols-1 max-[640px]:gap-[var(--space-3)]`,
  footerBrand:
    "block font-[720] text-muted-strong",
  footerMeta:
    "m-0 mt-1 text-[0.88rem] text-muted",
  footerLinks:
    "flex max-w-[520px] flex-wrap items-center justify-end gap-[var(--space-1)] max-[640px]:justify-start",
  footerLink:
    "interaction-overlay rounded-[var(--radius-sm)] px-2.5 py-2 text-[0.875rem] font-medium tracking-[0] text-muted transition-colors duration-[160ms] hover:no-underline",

  homeIntro:
    "home-intro w-full scroll-mt-28",
  minWidthZero: "min-w-0",
  tagline:
    "tagline mb-3 block text-[0.875rem] font-medium text-muted",
  homeTitle:
    `page-title mb-5 mt-0 ${pageHeading}`,
  pageTitle:
    `page-title mb-3 mt-0 ${pageHeading}`,
  aboutCopy:
    "flex flex-col gap-[1.15em] text-[length:var(--type-body)] leading-[1.75] text-ink-soft break-keep wrap-anywhere [&_p]:m-0",
  pageSubtitle:
    "m-0 max-w-[720px] wrap-anywhere text-[clamp(1rem,2vw,1.18rem)] text-muted",
  homeSummary:
    "mt-6 flex flex-wrap items-center gap-x-5 gap-y-2",
  summaryPill:
    "inline-flex min-h-11 items-center text-[0.875rem] text-accent underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-ink",

  latestStrip:
    "latest-strip relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 overflow-hidden border-b border-line py-[26px] max-[860px]:grid-cols-1",
  latestGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,color-mix(in_srgb,var(--color-accent)_3%,transparent)_0%,transparent_65%)]",
  latestTitle:
    "mb-2 mt-0 max-w-[760px] text-[clamp(1.375rem,2.4vw,1.75rem)] font-bold leading-[1.4] text-balance",
  latestLink:
    "bg-[linear-gradient(var(--color-accent-ink),var(--color-accent-ink))] bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-inherit transition-[color,background-size] duration-[240ms] ease-out-expo hover:bg-[length:100%_2px] hover:text-accent-ink",
  latestDescription:
    "m-0 max-w-[760px] wrap-anywhere text-muted-strong",
  latestDate:
    "whitespace-nowrap text-[0.88rem] font-[760] text-accent-ink",

  topicRail:
    "grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6 my-7 mb-11 max-[860px]:grid-cols-1",
  sectionTitle:
    "m-0 text-[clamp(1.375rem,2.4vw,1.75rem)] font-bold leading-[1.4]",
  tagList: "flex flex-wrap gap-2",
  tagPill:
    "interaction-overlay tag inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-transparent bg-soft px-3 py-2 text-[0.875rem] font-medium leading-[1.4] text-accent-ink transition-colors duration-[160ms] hover:no-underline",
  tagCount:
    "text-[0.8125rem] text-muted-strong",
  pageSection: "scroll-mt-28",
  archive: "w-full",
  archiveIntro: "mb-7",
  archiveTitle:
    "mb-2 mt-0 text-[1.5rem] font-bold leading-[1.4] tracking-[-0.015em] text-ink",
  archiveSubtitle:
    "m-0 text-base leading-[1.7] text-muted-strong",
  sectionHeading: "mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2",
  sectionMeta:
    "m-0 text-[0.875rem] font-medium tracking-[0] text-muted tabular-nums",
  activeSearch:
    "mt-5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]",
  activeSearchLabel:
    "max-w-full wrap-anywhere text-muted-strong",
  activeSearchClear:
    "py-1 text-muted underline underline-offset-4 hover:text-ink",
  searchLabel:
    "sr-only",
  emptyState:
    "py-12 text-[0.95rem] text-muted",
  seriesList:
    "border-y border-line",
  seriesCard:
    "border-b border-line last:border-b-0",
  seriesCardLink:
    "interaction-overlay -mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-[var(--radius-md)] px-4 py-[var(--space-5)] text-inherit transition-colors duration-[180ms] hover:no-underline max-[640px]:grid-cols-1 max-[640px]:gap-3 max-[640px]:py-[var(--space-4)]",
  seriesBody:
    "min-w-0",
  seriesTopline:
    "mb-3 text-[0.875rem] font-medium tracking-[0] text-muted",
  seriesTitle:
    "mb-3 mt-0 text-[clamp(1.25rem,2vw,1.5rem)] font-bold leading-[1.4] text-accent-ink text-balance",
  seriesPreviewList:
    "flex flex-wrap gap-2",
  seriesPreviewItem:
    "rounded-[var(--radius-pill)] border border-card-border px-3 py-2 text-[0.875rem] leading-[1.4] text-muted-strong",
  seriesAction:
    "whitespace-nowrap pt-1 text-[0.875rem] font-medium tracking-[0] text-muted max-[640px]:pt-0",

  postList: "post-list space-y-[2rem] max-[640px]:space-y-[1.75rem]",
  postCard:
    "post-item",
  postCardLink:
    "post-link block rounded-[var(--radius-xs)] text-inherit hover:text-inherit hover:no-underline",
  postMeta: "post-meta mb-1 flex flex-wrap items-baseline gap-x-2 text-[length:var(--type-list-meta)] leading-[1.6] text-muted-strong",
  postDate: "block tabular-nums",
  postCategory: "text-muted-strong",
  postTitle:
    "post-title mb-1.5 mt-0 text-[length:var(--type-list-title)] font-bold leading-[1.45] tracking-[-0.015em] text-accent break-keep wrap-anywhere text-pretty",
  postDescription:
    "m-0 line-clamp-2 text-[0.9375rem] leading-[1.75] text-ink-soft",

  articleHeader:
    "mb-12 max-[640px]:mb-9",
  articleTitle:
    "mb-4 mt-0 text-[length:var(--type-article-title)] font-bold leading-[1.4] tracking-[-0.02em] text-ink break-keep wrap-anywhere text-pretty",

  meta:
    "meta m-0 flex flex-wrap items-center gap-2 text-[length:var(--type-meta)] leading-[1.6] text-muted-strong tabular-nums",
  contentPanel:
    "content content-panel w-full min-w-0",

  toc:
    "toc",
  tocSummary:
    "toc-summary",
  tocList: "list-none",
  tocItem: "",
  tocItemNested: "",
  tocLink:
    "text-[0.875rem] leading-[1.6] text-muted-strong transition-colors duration-[160ms] hover:text-ink hover:no-underline",
  tocLinkNested:
    "text-[0.8125rem] leading-[1.6] text-muted transition-colors duration-[160ms] hover:text-ink hover:no-underline",

  relatedSection:
    "related mt-14 border-t border-line pt-8",
  relatedTitle: "mb-5 mt-0 text-[1.125rem] font-semibold text-muted-strong",
  relatedGrid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-3",
  relatedCard:
    "interaction-overlay related-card -mx-3 rounded-[var(--radius-md)] px-3 py-3 text-inherit transition-colors duration-[160ms] hover:no-underline",
  relatedKicker:
    "mb-2 block text-[0.875rem] text-muted",
  relatedMeta: "text-[0.875rem] text-muted",
  relatedDescription: "m-0 mt-2 text-muted",

  searchBox:
    "search-box glass-surface mb-5 w-full max-w-[620px] rounded-[var(--radius-card)] border border-card-border px-3.5 py-[13px] text-ink transition-[background,border-color,box-shadow] duration-[200ms] focus:border-accent-blend focus:bg-[var(--color-glass-hover)] focus:shadow-glass-md focus:outline-none",

  themeToggle:
    "interaction-overlay theme-toggle group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-transparent bg-transparent p-0 leading-none text-muted-strong transition-colors duration-[160ms]",
  themeToggleLightIcon: "hidden group-data-[current=light]:flex",
  themeToggleDarkIcon: "hidden group-data-[current=dark]:flex",
} as const;
