const pageFrame = "mx-auto w-full max-w-[980px] px-6 max-[640px]:px-[18px]";
const pageHeading = "text-[clamp(1.35rem,2.8vw,1.65rem)] font-[650] leading-[1.4] tracking-[-0.02em] text-ink text-balance";

export const ui = {
  siteHeader:
    "sticky top-0 z-10 border-b border-header-border bg-header-bg",
  nav:
    `${pageFrame} relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] py-3 max-[640px]:gap-x-1.5 max-[640px]:py-2.5`,
  brand:
    "inline-flex min-w-0 items-center text-ink font-[760] tracking-[-0.01em] transition-opacity duration-[160ms] hover:opacity-70 hover:no-underline",
  navLinks:
    "flex min-w-0 items-center justify-end gap-0.5 text-[0.9rem] max-[640px]:text-[0.84rem]",
  navActions:
    "flex shrink-0 items-center justify-end gap-0.5",
  navLink:
    "relative shrink-0 px-2 py-2 transition-colors duration-[160ms] after:absolute after:inset-x-2 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-[180ms] after:content-[''] hover:text-ink hover:no-underline hover:after:scale-x-100 max-[640px]:px-1.5 max-[640px]:after:inset-x-1.5",
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
    "h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-line bg-paper px-3 text-[0.95rem] text-ink transition-[border-color] duration-[160ms] focus:border-line-strong focus:outline-none max-[640px]:text-base",
  navIconButton:
    "group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-transparent bg-transparent p-0 text-muted-strong transition-[background,color] duration-[160ms] hover:bg-soft hover:text-ink",
  shell:
    `${pageFrame} flex-1 pb-14 pt-10 max-[640px]:pb-10 max-[640px]:pt-8`,
  siteFooter:
    "shrink-0 border-t border-line",
  footerInner:
    `${pageFrame} grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--space-6)] py-6 text-[0.85rem] max-[640px]:grid-cols-1 max-[640px]:gap-[var(--space-3)]`,
  footerBrand:
    "block font-[720] text-muted-strong",
  footerMeta:
    "m-0 mt-1 text-[0.88rem] text-muted",
  footerLinks:
    "flex max-w-[520px] flex-wrap items-center justify-end gap-[var(--space-1)] max-[640px]:justify-start",
  footerLink:
    "rounded-[var(--radius-sm)] px-2.5 py-2 font-mono text-[0.8rem] font-[680] uppercase tracking-[0] text-muted transition-[background,color] duration-[160ms] hover:bg-accent-soft hover:text-accent-ink hover:no-underline",

  homeIntro:
    "home-intro w-full scroll-mt-28",
  minWidthZero: "min-w-0",
  tagline:
    "tagline mb-2 block text-[0.75rem] font-[500] text-muted",
  homeTitle:
    `page-title mb-5 mt-0 ${pageHeading}`,
  pageTitle:
    `page-title mb-3 mt-0 ${pageHeading}`,
  aboutCopy:
    "space-y-3 text-[0.95rem] leading-[1.8] text-muted-strong [&_p]:m-0",
  pageSubtitle:
    "m-0 max-w-[720px] wrap-anywhere text-[clamp(1rem,2vw,1.18rem)] text-muted",
  homeSummary:
    "mt-6 flex flex-wrap items-center gap-x-5 gap-y-2",
  summaryPill:
    "inline-flex min-h-10 items-center text-[0.85rem] text-muted-strong underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink",

  latestStrip:
    "latest-strip relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 overflow-hidden border-b border-line py-[26px] max-[860px]:grid-cols-1",
  latestGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,color-mix(in_srgb,var(--color-accent)_3%,transparent)_0%,transparent_65%)]",
  latestTitle:
    "mb-2 mt-0 max-w-[760px] text-[clamp(1.15rem,2.2vw,1.55rem)] leading-[1.18] text-balance",
  latestLink:
    "bg-[linear-gradient(var(--color-accent-ink),var(--color-accent-ink))] bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-inherit transition-[color,background-size] duration-[240ms] ease-out-expo hover:bg-[length:100%_2px] hover:text-accent-ink",
  latestDescription:
    "m-0 max-w-[760px] wrap-anywhere text-muted-strong",
  latestDate:
    "whitespace-nowrap text-[0.88rem] font-[760] text-accent-ink",

  topicRail:
    "grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6 my-7 mb-11 max-[860px]:grid-cols-1",
  sectionTitle:
    "m-0 text-[clamp(1.2rem,2.2vw,1.55rem)] leading-[1.18]",
  tagList: "flex flex-wrap gap-2",
  tagPill:
    "tag inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-card-border bg-[var(--color-glass)] px-2.5 py-[7px] font-mono text-[0.82rem] font-[640] leading-none text-ink-soft transition-[background,border-color,color,transform,box-shadow] duration-[200ms] ease-spring hover:-translate-y-0.5 hover:scale-[1.02] hover:border-card-border-strong hover:bg-[var(--color-glass-hover)] hover:text-accent-ink hover:shadow-glass-sm hover:no-underline",
  tagCount:
    "text-[0.74rem] text-muted",
  pageSection: "scroll-mt-28",
  archive: "w-full",
  archiveIntro: "mb-6",
  archiveTitle:
    `mb-2 mt-0 ${pageHeading}`,
  archiveSubtitle:
    "m-0 text-[0.95rem] leading-[1.7] text-muted-strong",
  sectionHeading: "mb-[18px] flex items-end justify-between max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-[var(--space-2)]",
  sectionMeta:
    "m-0 font-mono text-[0.8rem] font-[640] uppercase tracking-[0] text-muted tabular-nums",
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
    "group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-[var(--space-5)] text-inherit transition-[background,padding,color] duration-[180ms] hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] hover:pl-2 hover:text-ink hover:no-underline max-[640px]:grid-cols-1 max-[640px]:gap-3 max-[640px]:py-[var(--space-4)]",
  seriesBody:
    "min-w-0",
  seriesTopline:
    "mb-2 font-mono text-[0.76rem] font-[680] uppercase tracking-[0] text-muted",
  seriesTitle:
    "mb-3 mt-0 text-[clamp(1.08rem,1.8vw,1.32rem)] leading-[1.22] text-accent-ink text-balance",
  seriesPreviewList:
    "flex flex-wrap gap-2",
  seriesPreviewItem:
    "rounded-[var(--radius-pill)] border border-card-border px-2.5 py-[7px] text-[0.82rem] leading-none text-muted-strong",
  seriesAction:
    "whitespace-nowrap pt-1 font-mono text-[0.78rem] font-[680] uppercase tracking-[0] text-muted transition-colors duration-[160ms] group-hover:text-accent-ink max-[640px]:pt-0",

  postList: "post-list",
  postCard:
    "post-item border-b border-line last:border-b-0",
  postCardLink:
    "block py-[18px] text-inherit transition-opacity duration-[160ms] hover:opacity-70 hover:text-inherit hover:no-underline max-[640px]:py-4",
  postMeta: "post-meta flex flex-wrap items-baseline gap-x-2",
  postDate: "mt-2 block text-[0.75rem] text-muted tabular-nums",
  postCategory: "mt-2 text-[0.75rem] text-muted",
  postTitle:
    "mb-1.5 mt-0 block text-[clamp(1rem,2vw,1.1rem)] font-[650] leading-[1.4] text-ink text-balance",
  postDescription:
    "m-0 line-clamp-1 text-[0.875rem] leading-[1.5] text-muted-strong",

  meta:
    "meta mb-6 mt-0 flex flex-wrap items-center gap-2 text-[0.75rem] text-muted tabular-nums",
  postLayout:
    "post-layout grid grid-cols-[minmax(0,1fr)_200px] gap-8 max-[860px]:grid-cols-1",
  contentPanel:
    "content content-panel min-w-0 border-t border-line pt-6",

  toc:
    "toc sticky top-[84px] self-start overflow-hidden border-l border-line max-[860px]:static max-[860px]:border-l-0 max-[860px]:border-t",
  tocTitle:
    "mb-1 mt-0 px-4 py-2 text-[0.75rem] font-[500] text-muted",
  tocList: "list-none",
  tocItem: "",
  tocItemNested: "",
  tocLink:
    "text-[0.8rem] text-muted-strong transition-colors duration-[160ms] hover:text-ink hover:no-underline",
  tocLinkNested:
    "text-[0.75rem] text-muted transition-colors duration-[160ms] hover:text-ink hover:no-underline",

  relatedSection:
    "related mt-8 border-t border-line pt-5",
  relatedTitle: "mb-3 mt-0 text-[0.9rem] font-[600] text-muted-strong",
  relatedGrid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-3",
  relatedCard:
    "related-card py-2 text-inherit transition-opacity duration-[160ms] hover:opacity-70 hover:no-underline",
  relatedKicker:
    "mb-1 block text-[0.75rem] text-muted",
  relatedMeta: "text-[0.75rem] text-muted",
  relatedDescription: "m-0 mt-2 text-muted",

  searchBox:
    "search-box glass-surface mb-5 w-full max-w-[620px] rounded-[var(--radius-card)] border border-card-border px-3.5 py-[13px] text-ink transition-[background,border-color,box-shadow] duration-[200ms] focus:border-accent-blend focus:bg-[var(--color-glass-hover)] focus:shadow-glass-md focus:outline-none",

  themeToggle:
    "theme-toggle group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-transparent bg-transparent p-0 leading-none text-muted-strong transition-[background,color] duration-[160ms] hover:bg-soft hover:text-ink",
  themeToggleLightIcon: "hidden group-data-[current=light]:flex",
  themeToggleDarkIcon: "hidden group-data-[current=dark]:flex",
} as const;
