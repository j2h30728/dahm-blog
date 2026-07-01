export const ui = {
  siteHeader:
    "sticky top-0 z-10 border-b border-header-border bg-header-bg backdrop-blur-[18px]",
  nav:
    "mx-auto flex max-w-[980px] items-center justify-between gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-4)] max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-[var(--space-3)] max-[640px]:px-[18px] max-[640px]:py-3.5",
  brand:
    "inline-flex items-center gap-[var(--space-2)] text-ink font-[780] tracking-[0] transition-opacity duration-[160ms] hover:opacity-80",
  brandMark:
    "inline-block h-3 w-3 rounded-[var(--radius-pill)] bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_14%,transparent)]",
  navLinks:
    "flex items-center gap-[var(--space-1)] text-[0.92rem] max-[640px]:w-full",
  navLink:
    "relative rounded-[var(--radius-sm)] px-2.5 py-2 text-muted-strong transition-[background,color] duration-[160ms] after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-[1px] after:bg-accent after:transition-transform after:duration-[220ms] after:ease-out-expo after:content-[''] hover:bg-accent-soft hover:text-accent-ink hover:no-underline hover:after:scale-x-100 max-[640px]:px-2",
  shell:
    "mx-auto max-w-[980px] px-6 pb-[72px] pt-14 max-[640px]:px-[18px] max-[640px]:pb-12 max-[640px]:pt-[38px]",
  siteFooter:
    "border-t border-line",
  footerInner:
    "mx-auto flex max-w-[980px] items-center justify-between gap-[var(--space-4)] px-6 py-8 text-[0.9rem] max-[640px]:px-[18px] max-[640px]:py-6",
  footerBrand:
    "font-[720] text-muted-strong",
  footerLinks:
    "flex items-center gap-[var(--space-2)]",
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
  postTagList: "post-tags flex flex-wrap gap-2",

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
    "search-box glass-surface mb-6 w-full max-w-[620px] rounded-[var(--radius-card)] border border-card-border px-3.5 py-[13px] text-ink transition-[background,border-color,box-shadow] duration-[200ms] focus:border-accent-blend focus:bg-[var(--color-glass-hover)] focus:shadow-glass-md focus:outline-none",

  themeToggle:
    "theme-toggle group flex cursor-pointer items-center rounded-[var(--radius-sm)] border-0 bg-transparent px-2.5 py-2 leading-none text-muted-strong transition-[background,color,transform] duration-[200ms] ease-spring hover:scale-110 hover:rotate-12 hover:bg-soft hover:text-ink",
  themeToggleLightIcon: "hidden group-data-[current=light]:flex",
  themeToggleDarkIcon: "hidden group-data-[current=dark]:flex",
} as const;
