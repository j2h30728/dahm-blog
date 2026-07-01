export const ui = {
  siteHeader:
    "sticky top-0 z-10 border-b border-header-border bg-header-bg backdrop-blur-[18px]",
  nav:
    "relative mx-auto flex max-w-[980px] items-center justify-between gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-4)] max-[640px]:flex-wrap max-[640px]:gap-x-[var(--space-2)] max-[640px]:gap-y-1 max-[640px]:px-[18px] max-[640px]:py-2.5",
  brand:
    "inline-flex shrink-0 items-center gap-[var(--space-2)] text-ink font-[780] tracking-[0] transition-opacity duration-[160ms] hover:opacity-80",
  brandMark:
    "inline-block h-3 w-3 rounded-[var(--radius-pill)] bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_14%,transparent)]",
  navLinks:
    "flex min-w-0 flex-1 items-center justify-end gap-[var(--space-1)] overflow-x-auto text-[0.92rem] max-[640px]:gap-0.5 max-[640px]:overflow-visible max-[640px]:text-[0.86rem]",
  navActions:
    "flex shrink-0 items-center justify-end gap-[var(--space-1)] max-[640px]:min-w-0 max-[640px]:basis-full max-[640px]:gap-1",
  navLink:
    "relative shrink-0 rounded-[var(--radius-sm)] px-2.5 py-2 text-muted-strong transition-[background,color] duration-[160ms] after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-[1px] after:bg-accent after:transition-transform after:duration-[220ms] after:ease-out-expo after:content-[''] hover:bg-accent-soft hover:text-accent-ink hover:no-underline hover:after:scale-x-100 max-[640px]:px-1.5 max-[640px]:py-1.5 max-[640px]:after:inset-x-1.5",
  navLinkActive:
    "text-accent-ink after:scale-x-100",
  navSearchForm:
    "flex min-w-0 shrink-0 items-center justify-end overflow-hidden transition-[width,opacity,margin,transform] duration-[260ms] ease-out-expo motion-reduce:transition-none",
  navSearchFormOpen:
    "ml-1 w-[clamp(128px,22vw,220px)] opacity-100 max-[760px]:w-[116px] max-[640px]:ml-0 max-[640px]:flex-1 max-[640px]:w-auto max-[640px]:translate-y-0",
  navSearchFormClosed:
    "ml-0 w-0 opacity-0 pointer-events-none max-[640px]:translate-y-[-4px]",
  navSearchField:
    "h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-card-border bg-[var(--color-glass)] px-3 text-[0.92rem] text-ink transition-[background,border-color,box-shadow] duration-[180ms] focus:border-accent-blend focus:bg-[var(--color-glass-hover)] focus:shadow-glass-sm focus:outline-none max-[640px]:h-9 max-[640px]:px-2 max-[640px]:text-[0.82rem]",
  navIconButton:
    "group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-transparent bg-transparent p-0 text-muted-strong transition-[background,border-color,color] duration-[200ms] hover:border-card-border hover:bg-soft hover:text-ink max-[640px]:h-9 max-[640px]:w-9",
  shell:
    "mx-auto max-w-[980px] px-6 pb-[72px] pt-14 max-[640px]:px-[18px] max-[640px]:pb-12 max-[640px]:pt-[38px]",
  siteFooter:
    "border-t border-line",
  footerInner:
    "mx-auto grid max-w-[980px] grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--space-6)] px-6 py-8 text-[0.9rem] max-[640px]:grid-cols-1 max-[640px]:gap-[var(--space-3)] max-[640px]:px-[18px] max-[640px]:py-6",
  footerBrand:
    "block font-[720] text-muted-strong",
  footerMeta:
    "m-0 mt-1 text-[0.88rem] text-muted",
  footerLinks:
    "flex max-w-[520px] flex-wrap items-center justify-end gap-[var(--space-1)] max-[640px]:justify-start",
  footerLink:
    "rounded-[var(--radius-sm)] px-2.5 py-2 font-mono text-[0.8rem] font-[680] uppercase tracking-[0] text-muted transition-[background,color] duration-[160ms] hover:bg-accent-soft hover:text-accent-ink hover:no-underline",

  homeIntro:
    "home-intro grid scroll-mt-28 grid-cols-[minmax(0,1fr)_auto] gap-[var(--space-6)] border-b border-line pb-[34px] pt-2.5 transition-[opacity,transform,filter] duration-[600ms] ease-out-expo max-[860px]:grid-cols-1",
  minWidthZero: "min-w-0",
  tagline:
    "tagline mb-3 block font-mono text-[0.76rem] font-[680] uppercase tracking-[0] text-accent-ink",
  homeTitle:
    "page-title mb-3 max-w-[760px] text-[clamp(1.35rem,2.4vw,1.95rem)] font-[700] leading-[1.18] tracking-[0] text-ink text-balance transition-[opacity,transform,filter] delay-100 duration-[700ms] ease-out-expo max-[640px]:text-[clamp(1.35rem,6vw,1.8rem)]",
  pageTitle:
    "page-title mb-4 max-w-[820px] text-[clamp(1.45rem,2.8vw,2.2rem)] font-[720] leading-[1.16] tracking-[0] text-ink text-balance transition-[opacity,transform,filter] delay-100 duration-[700ms] ease-out-expo max-[640px]:text-[clamp(1.4rem,6vw,1.8rem)]",
  aboutCopy:
    "max-w-[720px] space-y-[var(--space-2)] text-[clamp(1rem,2vw,1.12rem)] text-muted [&_p]:m-0",
  pageSubtitle:
    "m-0 max-w-[720px] wrap-anywhere text-[clamp(1rem,2vw,1.18rem)] text-muted",
  homeSummary:
    "flex max-w-[260px] flex-wrap justify-end gap-[var(--space-2)] self-end max-[860px]:max-w-none max-[860px]:justify-start",
  summaryPill:
    "summary-pill glass-surface rounded-[var(--radius-pill)] border border-card-border px-2.5 py-[7px] font-mono text-[0.82rem] font-[640] leading-none text-muted transition-[background,border-color,color,box-shadow] duration-[160ms] hover:border-accent-blend hover:bg-accent-soft hover:text-accent-ink hover:shadow-glass-md hover:no-underline",

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
    "tag rounded-[var(--radius-pill)] border border-card-border bg-[var(--color-glass)] px-2.5 py-[7px] font-mono text-[0.82rem] font-[640] leading-none text-ink-soft transition-[background,border-color,color,transform,box-shadow] duration-[200ms] ease-spring hover:-translate-y-0.5 hover:scale-[1.02] hover:border-card-border-strong hover:bg-[var(--color-glass-hover)] hover:text-accent-ink hover:shadow-glass-sm hover:no-underline",
  pageSection: "scroll-mt-28",
  archiveSection: "mt-12 scroll-mt-28",
  sectionHeading: "mb-[18px] flex items-end justify-between max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-[var(--space-2)]",
  sectionMeta:
    "m-0 font-mono text-[0.8rem] font-[640] uppercase tracking-[0] text-muted tabular-nums",
  archiveTools:
    "mb-7 border-y border-line py-5",
  activeSearch:
    "mb-5 flex min-w-0 flex-wrap items-center gap-2",
  activeSearchLabel:
    "max-w-full wrap-anywhere rounded-[var(--radius-pill)] border border-accent-blend bg-accent-soft px-2.5 py-[7px] font-mono text-[0.8rem] font-[640] leading-snug text-accent-ink",
  activeSearchClear:
    "rounded-[var(--radius-pill)] border border-card-border px-2.5 py-[7px] font-mono text-[0.8rem] font-[640] leading-none text-muted transition-[background,border-color,color] duration-[160ms] hover:border-card-border-strong hover:bg-[var(--color-glass-hover)] hover:text-accent-ink hover:no-underline",
  searchLabel:
    "sr-only",
  filterGrid:
    "grid grid-cols-1 gap-5",
  filterGroup:
    "min-w-0",
  filterLabel:
    "m-0 mb-2 font-mono text-[0.74rem] font-[680] uppercase tracking-[0] text-muted",
  filterList:
    "flex flex-wrap gap-2",
  filterPill:
    "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border border-card-border bg-transparent px-2.5 py-[7px] font-mono text-[0.8rem] font-[640] leading-none text-ink-soft transition-[background,border-color,color,transform,box-shadow] duration-[160ms] ease-spring hover:-translate-y-0.5 hover:border-card-border-strong hover:bg-[var(--color-glass-hover)] hover:text-accent-ink hover:shadow-glass-sm",
  filterPillActive:
    "border-accent-blend bg-accent-soft text-accent-ink shadow-glass-sm",
  filterCount:
    "text-[0.74rem] text-muted",
  emptyState:
    "border-y border-line py-8 text-muted",
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

  postList: "post-list border-y border-line",
  postCard:
    "post-item border-b border-line last:border-b-0",
  postCardLink:
    "grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-4 py-[var(--space-5)] text-inherit transition-[color,background,padding] duration-[180ms] hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] hover:pl-2 hover:text-ink hover:no-underline max-[720px]:grid-cols-[36px_minmax(0,1fr)] max-[720px]:gap-3 max-[640px]:py-[var(--space-4)]",
  postIndex:
    "font-mono text-[0.78rem] font-[720] leading-[1.8] text-accent-ink tabular-nums",
  postBody: "min-w-0",
  postTopline:
    "mb-[7px] flex flex-wrap items-center gap-[var(--space-2)] font-mono text-[0.78rem] font-[640] uppercase tracking-[0] text-muted max-[640px]:gap-[3px]",
  postSeries: "tracking-[0] text-teal",
  postDate: "whitespace-nowrap pt-[3px] font-mono text-[0.78rem] font-[640] tracking-[0] text-muted tabular-nums max-[720px]:col-start-2 max-[720px]:pt-0",
  postTitle:
    "mb-1.5 mt-0 block text-[clamp(1.08rem,1.8vw,1.28rem)] leading-[1.26] text-balance",
  postDescription:
    "m-0 max-w-[760px] text-muted-strong",
  postTagList: "post-tags mt-3 flex flex-wrap gap-2",
  postTag:
    "rounded-[var(--radius-pill)] border border-card-border px-2 py-1 font-mono text-[0.72rem] font-[620] leading-none text-muted",

  meta:
    "meta my-3 mb-[30px] flex flex-wrap items-center gap-2 text-muted",
  postLayout:
    "post-layout grid grid-cols-[minmax(0,1fr)_220px] gap-10 max-[860px]:grid-cols-1",
  contentPanel:
    "content content-panel min-w-0 border-y border-line py-[clamp(22px,4vw,44px)] max-[640px]:py-[18px]",

  toc:
    "toc sticky top-[84px] self-start overflow-hidden border-l border-line transition-[border-color] duration-[200ms] hover:border-accent-blend max-[860px]:static max-[860px]:border-l-0 max-[860px]:border-t",
  tocTitle:
    "mb-0 mt-0 border-b border-card-border px-4 py-[10px] font-mono text-[0.68rem] font-[680] uppercase tracking-[0] text-muted",
  tocList: "list-none",
  tocItem: "",
  tocItemNested: "",
  tocLink:
    "text-[0.85rem] text-ink-soft transition-colors duration-[160ms] hover:text-accent-ink hover:no-underline",
  tocLinkNested:
    "text-[0.79rem] text-muted transition-colors duration-[160ms] hover:text-accent-ink hover:no-underline",

  relatedSection:
    "related mt-12 border-t border-line pt-[26px]",
  relatedTitle: "mb-4 mt-0 text-[1.12rem]",
  relatedGrid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3",
  relatedCard:
    "related-card border-t border-line p-4 text-inherit transition-[background,border-color,transform] duration-[200ms] ease-spring hover:-translate-y-0.5 hover:border-accent-blend hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] hover:no-underline",
  relatedKicker:
    "mb-1.5 block font-mono text-[0.76rem] font-[680] uppercase tracking-[0] text-teal",
  relatedMeta: "text-muted",
  relatedDescription: "m-0 mt-2 text-muted",

  searchBox:
    "search-box glass-surface mb-5 w-full max-w-[620px] rounded-[var(--radius-card)] border border-card-border px-3.5 py-[13px] text-ink transition-[background,border-color,box-shadow] duration-[200ms] focus:border-accent-blend focus:bg-[var(--color-glass-hover)] focus:shadow-glass-md focus:outline-none",

  themeToggle:
    "theme-toggle group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-transparent bg-transparent p-0 leading-none text-muted-strong transition-[background,border-color,color] duration-[200ms] hover:border-card-border hover:bg-soft hover:text-ink max-[640px]:h-9 max-[640px]:w-9",
  themeToggleLightIcon: "hidden group-data-[current=light]:flex",
  themeToggleDarkIcon: "hidden group-data-[current=dark]:flex",
} as const;
