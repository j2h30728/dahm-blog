import { navigate } from 'astro:transitions/client';

interface SearchItem { href: string; title: string; description: string; excerpt: string; tags: string[]; kind: string; category: string; date: string; }
let controller: AbortController | undefined;
let cleanups: Array<() => void> = [];

function initialize() {
  controller?.abort();
  cleanups.forEach(cleanup => cleanup());
  cleanups = [];
  controller = new AbortController();
  const { signal } = controller;
  let index: SearchItem[] = [];
  try { index = JSON.parse(document.querySelector('#search-data')?.textContent || '[]'); } catch { /* Empty public index. */ }
  bindSearch(signal);
  bindTheme(signal);
  bindImages(signal);
  bindCodeCopy(signal);
  bindToc(signal);
  bindPreviews(signal, index);
  bindComments();
}

function bindSearch(signal: AbortSignal) {
  const form = document.querySelector<HTMLFormElement>('#site-search-form');
  const input = document.querySelector<HTMLInputElement>('#site-search');
  const toggle = document.querySelector<HTMLButtonElement>('[data-search-toggle]');
  if (!form || !input || !toggle) return;
  const archive = document.querySelector('[data-archive]');
  const empty = document.querySelector<HTMLElement>('[data-empty-state]');
  const emptyText = empty?.textContent || '';
  const cards = [...document.querySelectorAll<HTMLElement>('[data-post-card]')];
  const categoryLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-post-category][data-category-href]')];
  const tit = document.querySelector('[data-tit-archive]');
  const tagButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-tit-tag]')];
  const knownTags = new Set(tagButtons.map(button => button.dataset.titTag || '').filter(Boolean));
  const months = [...document.querySelectorAll<HTMLElement>('[data-tit-month]')];
  const tagsByCard = new Map(cards.map(card => {
    let tags: string[] = [];
    try {
      const value: unknown = JSON.parse(card.dataset.tags || '[]');
      if (Array.isArray(value)) tags = value.filter((tag): tag is string => typeof tag === 'string');
    } catch { /* A malformed optional tag list must not break text search. */ }
    return [card, tags] as const;
  }));
  let selectedTag = '';
  const updateCategoryLinks = (query: string) => {
    for (const link of categoryLinks) {
      const url = new URL(link.dataset.categoryHref!, location.origin);
      if (query.trim()) url.searchParams.set('q', query.trim());
      link.href = url.pathname + url.search;
    }
  };
  const setOpen = (open: boolean) => {
    form.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '검색 닫기' : '검색 열기');
  };
  const filter = (value: string) => {
    const query = value.trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      const textMatches = !query || Boolean(card.dataset.search?.includes(query));
      const tagMatches = !selectedTag || Boolean(tagsByCard.get(card)?.includes(selectedTag));
      card.hidden = !textMatches || !tagMatches;
      if (!card.hidden) count++;
    });
    months.forEach(month => { month.hidden = ![...month.querySelectorAll<HTMLElement>('[data-post-card]')].some(card => !card.hidden); });
    tagButtons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.titTag || '') === selectedTag)));
    const countElement = document.querySelector('[data-result-count]');
    if (countElement) countElement.textContent = String(count);
    if (empty) {
      empty.hidden = count > 0;
      empty.textContent = tit && (query || selectedTag) ? '조건에 맞는 메모가 없습니다.' : query ? '검색 결과가 없습니다.' : emptyText;
    }
    const state = document.querySelector<HTMLElement>('[data-search-state]');
    if (state) state.hidden = !query;
    const label = document.querySelector('[data-search-label]');
    if (label) label.textContent = `“${value.trim()}” 검색 결과`;
    updateCategoryLinks(value);
    const clear = document.querySelector<HTMLAnchorElement>('[data-search-clear]');
    if (tit && clear) {
      const url = new URL(location.href);
      url.searchParams.delete('q');
      if (selectedTag) url.searchParams.set('tag', selectedTag); else url.searchParams.delete('tag');
      clear.href = url.pathname + url.search + url.hash;
    }
  };
  const synchronize = () => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    if (tit) {
      const requested = params.get('tag') || '';
      selectedTag = knownTags.has(requested) ? requested : '';
      if (params.has('tag') && !selectedTag) {
        const url = new URL(location.href);
        url.searchParams.delete('tag');
        history.replaceState(history.state, '', url);
      }
    }
    input.value = query;
    setOpen(Boolean(query));
    if (archive) filter(query);
  };
  const updateUrl = (value: string) => {
    const url = new URL(location.href);
    if (value.trim()) url.searchParams.set('q', value.trim()); else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  };
  toggle.addEventListener('click', () => { const open = form.hidden; setOpen(open); if (open) input.focus(); }, { signal });
  tagButtons.forEach(button => button.addEventListener('click', () => {
    const tag = button.dataset.titTag || '';
    if (tag === selectedTag) return;
    selectedTag = tag;
    const url = new URL(location.href);
    if (tag) url.searchParams.set('tag', tag); else url.searchParams.delete('tag');
    // Preserve ClientRouter's history metadata when adding an in-page filter state.
    history.pushState({ ...history.state }, '', url);
    filter(input.value);
  }, { signal }));
  input.addEventListener('keydown', event => { if (event.key === 'Escape') { setOpen(false); toggle.focus(); } }, { signal });
  input.addEventListener('input', () => { if (archive) { filter(input.value); updateUrl(input.value); } }, { signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (archive) { filter(input.value); updateUrl(input.value); }
    else {
      const url = new URL(form.action, location.origin);
      if (input.value.trim()) url.searchParams.set('q', input.value.trim());
      navigate(url.pathname + url.search);
    }
  }, { signal });
  document.querySelector('[data-search-clear]')?.addEventListener('click', event => {
    event.preventDefault(); input.value = ''; updateUrl(''); filter(''); setOpen(false);
  }, { signal });
  document.querySelector('[data-brand]')?.addEventListener('click', event => {
    const click = event as MouseEvent;
    if (location.pathname === '/' && !click.metaKey && !click.ctrlKey && !click.shiftKey && !click.altKey && click.button === 0) {
      event.preventDefault(); history.pushState({}, '', '/'); input.value = ''; setOpen(false); filter(''); window.scrollTo({ top: 0 });
    }
  }, { signal });
  window.addEventListener('popstate', synchronize, { signal });
  synchronize();
  if (/^\/posts\/?$/.test(location.pathname) && new URLSearchParams(location.search).get('category') === 'life') {
    const params = new URLSearchParams(location.search); params.delete('category');
    navigate(`/life/${params.size ? '?' + params : ''}`, { history: 'replace' });
  }
}

function bindTheme(signal: AbortSignal) {
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!button) return;
  const reflect = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    button.dataset.current = dark ? 'dark' : 'light';
    button.setAttribute('aria-label', dark ? '밝은 테마로 변경' : '어두운 테마로 변경');
    const lightIcon = document.querySelector<SVGElement>('[data-light-icon]'); if (lightIcon) lightIcon.style.display = dark ? 'none' : '';
    const darkIcon = document.querySelector<SVGElement>('[data-dark-icon]'); if (darkIcon) darkIcon.style.display = dark ? '' : 'none';
    document.querySelector<HTMLIFrameElement>('.giscus-frame')?.contentWindow?.postMessage({ giscus: { setConfig: { theme: dark ? 'dark' : 'light' } } }, 'https://giscus.app');
  };
  button.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* Theme still works when storage is unavailable. */ }
    reflect();
  }, { signal });
  reflect();
}

function bindImages(signal: AbortSignal) {
  const dialog = document.createElement('dialog');
  dialog.className = 'post-image-dialog';
  dialog.setAttribute('aria-label', '본문 이미지 확대 보기');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'post-image-dialog__close'; close.setAttribute('aria-label', '이미지 확대 닫기'); close.textContent = '×';
  const large = document.createElement('img'); large.className = 'post-image-dialog__image';
  dialog.append(close, large); document.body.append(dialog);
  let trigger: HTMLElement | undefined;
  let previousOverflow = '', previousPadding = '';
  const restore = () => {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPadding;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = undefined;
  };
  const hide = () => { if (dialog.open) dialog.close(); };
  close.addEventListener('click', hide, { signal });
  dialog.addEventListener('close', restore, { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); hide(); }, { signal });
  let downOnBackdrop = false;
  dialog.addEventListener('pointerdown', event => { downOnBackdrop = event.target === dialog; }, { signal });
  dialog.addEventListener('click', event => { if (event.target === dialog && downOnBackdrop) hide(); downOnBackdrop = false; }, { signal });
  dialog.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); close.focus(); } }, { signal });
  for (const image of document.querySelectorAll<HTMLImageElement>('.content img')) {
    if (image.closest('.post-image-trigger')) continue;
    const link = image.closest<HTMLAnchorElement>('a');
    const button = link ?? document.createElement('button');
    if (!link) {
      (button as HTMLButtonElement).type = 'button'; button.className = 'post-image-trigger';
      image.before(button); button.append(image);
    }
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', `${image.alt.trim() || '본문 이미지'} 확대`);
    const width = Number(image.getAttribute('width'));
    if (width > 0 && !button.closest('.post-image-frame')) {
      const frame = document.createElement('span'); frame.className = 'post-image-frame'; frame.style.width = `${width}px`; frame.dataset.imageWidth = String(width);
      button.before(frame); frame.append(button);
    }
    button.addEventListener('click', event => {
      const click = event as MouseEvent;
      if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
      event.preventDefault(); trigger = button;
      large.src = image.currentSrc || image.src; large.alt = image.alt;
      dialog.setAttribute('aria-label', `${image.alt.trim() || '본문 이미지'} 확대 보기`);
      previousOverflow = document.body.style.overflow; previousPadding = document.body.style.paddingRight;
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbar > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
      document.body.style.overflow = 'hidden'; dialog.showModal(); close.focus({ preventScroll: true });
    }, { signal });
  }
  cleanups.push(() => { if (dialog.open) { dialog.close(); restore(); } dialog.remove(); });
}

function bindCodeCopy(signal: AbortSignal) {
  for (const pre of document.querySelectorAll<HTMLPreElement>('.content pre')) {
    if (pre.closest('.code-block-frame')) continue;
    const code = pre.querySelector('code'); if (!code) continue;
    const frame = document.createElement('div'); frame.className = 'code-block-frame'; pre.before(frame); frame.append(pre);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'code-copy-button'; button.setAttribute('aria-label', '코드 복사'); button.title = '코드 복사'; frame.append(button);
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code.textContent || ''); button.dataset.state = 'copied'; button.setAttribute('aria-label', '복사됨'); }
      catch { button.dataset.state = 'failed'; button.setAttribute('aria-label', '복사 실패'); }
      window.setTimeout(() => { if (button.isConnected) { button.dataset.state = 'idle'; button.setAttribute('aria-label', '코드 복사'); } }, 1400);
    }, { signal });
  }
}

function bindToc(signal: AbortSignal) {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
  const activate = () => {
    let current = links[0]?.dataset.headingId;
    const line = Math.min(innerHeight * 0.28, 160);
    for (const link of links) {
      const heading = document.getElementById(link.dataset.headingId || '');
      if (heading && heading.getBoundingClientRect().top <= line) current = heading.id;
    }
    links.forEach(link => { const active = link.dataset.headingId === current; if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); link.closest('li')?.classList.toggle('is-active', active); });
  };
  window.addEventListener('scroll', activate, { passive: true, signal });
  window.addEventListener('hashchange', activate, { signal });
  window.addEventListener('resize', activate, { signal });
  activate();
}

function bindPreviews(signal: AbortSignal, index: SearchItem[]) {
  const byHref = new Map(index.map(item => [item.href, item]));
  const preview = document.createElement('div'); preview.id = 'internal-link-preview'; preview.className = 'internal-link-preview'; preview.setAttribute('role', 'status'); preview.hidden = true; document.body.append(preview);
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('.content a')) {
    const url = new URL(anchor.href, location.href);
    const item = url.origin === location.origin ? byHref.get(url.pathname) : undefined;
    if (!item) continue;
    anchor.classList.add('internal-link');
    const hide = () => { preview.hidden = true; anchor.removeAttribute('aria-describedby'); };
    const show = () => {
      preview.replaceChildren(); const title = document.createElement('strong'); title.textContent = item.title; const summary = document.createElement('span'); summary.textContent = item.description || item.excerpt; preview.append(title, summary); preview.hidden = false; anchor.setAttribute('aria-describedby', preview.id);
      const rect = anchor.getBoundingClientRect(); const width = Math.min(320, innerWidth - 32); preview.style.width = `${width}px`; preview.style.left = `${Math.max(16, Math.min(rect.left, innerWidth - width - 16))}px`; preview.style.top = `${Math.max(16, Math.min(rect.bottom + 10, innerHeight - preview.offsetHeight - 16))}px`;
    };
    anchor.addEventListener('mouseenter', show, { signal }); anchor.addEventListener('focus', show, { signal }); anchor.addEventListener('mouseleave', hide, { signal }); anchor.addEventListener('blur', hide, { signal }); anchor.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, { signal });
  }
  cleanups.push(() => preview.remove());
}

function bindComments() {
  const container = document.querySelector<HTMLElement>('[data-comments]'); if (!container) return;
  let loaded = false;
  const load = () => {
    if (loaded) return; loaded = true;
    const script = document.createElement('script'); script.src = 'https://giscus.app/client.js'; script.async = true; script.crossOrigin = 'anonymous';
    const attrs = { repo: container.dataset.repo, 'repo-id': container.dataset.repoId, category: container.dataset.category, 'category-id': container.dataset.categoryId, mapping: 'specific', term: container.dataset.term, strict: '1', 'reactions-enabled': '1', 'emit-metadata': '0', 'input-position': 'top', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', lang: 'ko', loading: 'lazy' };
    for (const [key, value] of Object.entries(attrs)) if (value) script.setAttribute(`data-${key}`, value);
    container.querySelector('[data-comments-loading]')?.remove(); container.append(script);
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, { rootMargin: '200px' }); observer.observe(container); cleanups.push(() => observer.disconnect());
  } else load();
}

document.addEventListener('astro:page-load', initialize);
document.addEventListener('astro:before-swap', () => { controller?.abort(); cleanups.forEach(cleanup => cleanup()); cleanups = []; });
