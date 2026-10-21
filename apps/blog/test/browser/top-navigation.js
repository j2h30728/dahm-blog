async (page) => {
  const report = { passed: [], errors: [], screenshots: [] };
  const check = (value, message) => { if (!value) throw new Error(message); };
  const origin = "http://127.0.0.1:3037";
  const consoleErrors = [];
  const listener = (error) => consoleErrors.push(error.message);
  page.on("pageerror", listener);
  const nav = page.getByRole("navigation", { name: "메인 메뉴" });
  const input = page.getByRole("searchbox");
  const count = () => page.locator(".post-list > article").count();
  const active = async () => nav.locator('a[aria-current="page"]').allTextContents();
  const go = async (path) => page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  const search = async (query) => {
    await page.getByRole("button", { name: "글 검색", exact: true }).click();
    await input.fill(query);
    await input.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === query.trim());
    await page.waitForLoadState("networkidle");
  };
  const watchLogoNavigation = async (target = page, theme = "dark") => {
    const documentRequests = [];
    const watch = (request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    };
    await target.evaluate((theme) => {
      localStorage.setItem("theme", theme);
      document.documentElement.dataset.theme = theme;
      const probe = window.__logoNavigationProbe = {
        body: document.body, timeOrigin: performance.timeOrigin,
        color: getComputedStyle(document.body).backgroundColor, theme,
        colors: [], sampling: true,
      };
      const sample = () => {
        if (!probe.sampling) return;
        if (probe.colors.length < 180) probe.colors.push(getComputedStyle(document.body).backgroundColor);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, theme);
    target.on("request", watch);
    return async () => {
      target.off("request", watch);
      const result = await target.evaluate(() => {
        const probe = window.__logoNavigationProbe;
        if (!probe) return { sameDocument: false };
        probe.sampling = false;
        return {
          sameDocument: probe.body === document.body && probe.timeOrigin === performance.timeOrigin,
          sameTheme: document.documentElement.dataset.theme === probe.theme,
          sameBackground: getComputedStyle(document.body).backgroundColor === probe.color && probe.colors.every((color) => color === probe.color),
          frames: probe.colors.length,
        };
      });
      check(result.sameDocument && documentRequests.length === 0, "로고 이동에서 document reload 없음");
      check(result.sameTheme && result.sameBackground && result.frames > 0, "로고 이동 프레임에서 테마·배경 유지");
    };
  };
  try {
    await page.route("**/*", (route) => route.continue());
    await page.setViewportSize({ width: 1200, height: 900 });
    await go("/");
    const homeCount = await count();
    check(homeCount > 0, "홈 전체 목록");
    check(JSON.stringify(await nav.locator("a").allTextContents()) === JSON.stringify(["Dahm", "기술", "일상", "소개"]), "메뉴와 로고 구조");
    check((await active()).length === 0, "홈은 분류 메뉴를 강조하지 않음");
    check(await page.getByRole("navigation", { name: "글 분류" }).count() === 0, "중복 분류 탭 제거");
    const dates = await page.locator(".post-list time").evaluateAll((nodes) => nodes.map((node) => Date.parse(node.dateTime)));
    check(dates.every((date, index) => !index || dates[index - 1] >= date), "홈 최신 발행일순");
    for (const [path, title, expected] of [["/", "글과 선택의 기록.", homeCount], ["/tech/", "기술", homeCount], ["/life/", "일상", 0]]) {
      const response = await page.request.get(`${origin}${path}`);
      check(response.ok(), `${path} HTTP 응답`);
      const html = await response.text();
      check(html.includes(`<link rel="canonical" href="${origin}${path}"`), `${path} canonical`);
      check((html.match(/<article class="post-item /g) ?? []).length === expected, `${path} SSR 목록 범위`);
      await go(path);
      check(await page.getByRole("heading", { level: 1 }).textContent() === title, `${path} 제목`);
      check(await count() === expected, `${path} hydration 후 범위`);
    }
    report.passed.push("메뉴·로고, 홈 최신순, 중복 탭 제거, 홈/기술/일상 SSR·hydration·canonical");

    const logo = nav.getByRole("link", { name: "Dahm", exact: true });
    const assertHomeReset = async () => {
      await page.waitForURL(`${origin}/`, { timeout: 10000 });
      await page.waitForLoadState("networkidle");
      await input.waitFor({ state: "hidden" });
      check(await count() === homeCount, "로고 복귀 후 전체 글 복원");
      check(await page.getByRole("link", { name: "검색 해제", exact: true }).count() === 0, "검색 상태 표시 제거");
      check(await page.locator(".post-list time").evaluateAll((nodes) => nodes.every((node) => node.parentElement.textContent.includes("기술"))), "홈 분류 표시 유지");
      await page.getByRole("button", { name: "글 검색", exact: true }).click();
      check(await input.inputValue() === "", "로고 복귀 후 검색 입력 초기화");
      await page.keyboard.press("Escape");
    };
    const clickLogo = async (theme = "dark") => {
      const verify = await watchLogoNavigation(page, theme);
      await logo.click(); await assertHomeReset(); await verify();
    };
    await go("/");
    await search("Axios");
    await clickLogo();
    for (const path of ["/", "/tech/"]) {
      await go(path); await search("Axios");
      await page.locator(".post-list a").first().click();
      await page.waitForURL(`${origin}/posts/axios-cancel/`);
      await clickLogo();
    }
    for (const path of ["/life/?q=Axios", "/posts/?category=life&q=Axios"]) {
      await go(path); await clickLogo();
    }
    await page.getByRole("button", { name: "글 검색", exact: true }).click();
    await input.fill("작성 중인 검색어");
    await clickLogo("light");
    await go("/?q=Axios");
    const verifyKeyboardLogo = await watchLogoNavigation();
    await logo.focus(); await page.keyboard.press("Enter"); await assertHomeReset(); await verifyKeyboardLogo();
    const modifiedClick = await logo.evaluate((node) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
      const preserved = node.dispatchEvent(event);
      return { preserved, href: node.getAttribute("href") };
    });
    check(modifiedClick.preserved && modifiedClick.href === "/", "보조키 클릭과 홈 링크 목적지 유지");
    const touch = await page.context().browser().newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    try {
      const mobile = await touch.newPage();
      await mobile.goto(`${origin}/?q=Axios`, { waitUntil: "networkidle" });
      await mobile.locator(".post-list a").first().tap();
      await mobile.waitForURL(`${origin}/posts/axios-cancel/`);
      const verifyTouchLogo = await watchLogoNavigation(mobile);
      await mobile.getByRole("navigation", { name: "메인 메뉴" }).getByRole("link", { name: "Dahm", exact: true }).tap();
      await mobile.waitForURL(`${origin}/`);
      await mobile.waitForLoadState("networkidle");
      await verifyTouchLogo();
      check(await mobile.locator(".post-list > article").count() === homeCount, "모바일 터치 로고 전체 목록 복원");
      await mobile.getByRole("button", { name: "글 검색", exact: true }).tap();
      check(await mobile.getByRole("searchbox").inputValue() === "", "모바일 검색 입력 초기화");
      await mobile.getByRole("button", { name: "검색 닫기", exact: true }).tap();
      const path = "/Users/langdy-45/personal/dahm-blog/.playwright-mcp/logo-search-reset-mobile.png";
      await mobile.screenshot({ path }); report.screenshots.push(path);
    } finally { await touch.close(); }
    await go("/?q=Axios");
    await page.locator(".post-list a").first().click();
    await page.waitForURL(`${origin}/posts/axios-cancel/`);
    await clickLogo();
    await page.goBack();
    await page.waitForURL(`${origin}/posts/axios-cancel/`);
    await page.goBack();
    await page.waitForURL(`${origin}/?q=Axios`);
    check(await count() === 1, "뒤로가기에서 과거 검색 복원");
    await page.goForward(); await page.waitForURL(`${origin}/posts/axios-cancel/`);
    await page.goForward(); await page.waitForURL(`${origin}/`);
    check(await count() === homeCount, "앞으로가기에서 초기화된 전체 홈 복원");
    await go("/posts/axios-cancel/");
    await page.evaluate(() => {
      const menu = document.querySelector('nav[aria-label="메인 메뉴"]');
      menu.querySelector('a[href="/"]').click();
      menu.querySelector('a[href="/tech/"]').click();
    });
    await page.waitForURL(`${origin}/tech/`);
    report.passed.push("로고 검색 초기화, 문서·body·timeOrigin 유지/문서 요청0/프레임 배경 유지, Enter·보조키·터치, history·이동 취소");

    await go("/");
    await page.getByRole("button", { name: "글 검색", exact: true }).click();
    await input.fill("남기면 안 되는 검색어");
    await nav.getByRole("link", { name: "기술", exact: true }).click();
    await page.waitForURL(`${origin}/tech/`);
    check(!await input.isVisible(), "soft navigation에서 검색창 닫기");
    check(JSON.stringify(await active()) === JSON.stringify(["기술"]), "기술 활성 메뉴");
    await nav.getByRole("link", { name: "일상", exact: true }).click();
    await page.waitForURL(`${origin}/life/`);
    check(JSON.stringify(await active()) === JSON.stringify(["일상"]), "일상 활성 메뉴");
    await page.getByText("아직 일상 글이 없어요.", { exact: true }).waitFor();
    await nav.getByRole("link", { name: "소개", exact: true }).click();
    await page.waitForURL(`${origin}/about/`);
    check(JSON.stringify(await active()) === JSON.stringify(["소개"]), "소개 활성 메뉴");
    await nav.getByRole("link", { name: "Dahm", exact: true }).click();
    await page.waitForURL(`${origin}/`);
    check(await count() === homeCount, "로고 전체 홈 복귀");
    report.passed.push("홈→기술→일상→소개→로고, 활성 메뉴·빈 일상·검색창 초기화");
    await search("Axios");
    check(new URL(page.url()).pathname === "/" && new URL(page.url()).searchParams.get("q") === "Axios", "홈 검색 경로");
    check(await count() === 1, "전체 검색 결과");
    await page.getByRole("link", { name: "검색 해제", exact: true }).click();
    await page.waitForURL(`${origin}/`);
    check(await count() === homeCount, "전체 검색 해제");
    await nav.getByRole("link", { name: "기술", exact: true }).click();
    await page.waitForURL(`${origin}/tech/`);
    await search("Axios");
    check(new URL(page.url()).pathname === "/tech/" && await count() === 1, "기술 범위 검색");
    await page.getByRole("button", { name: "글 검색", exact: true }).click();
    await input.fill("미완성");
    await nav.getByRole("link", { name: "기술", exact: true }).click();
    await page.waitForURL(`${origin}/tech/`);
    check(!await input.isVisible() && await count() === homeCount, "같은 pathname의 메뉴 클릭도 검색 초기화");
    await nav.getByRole("link", { name: "일상", exact: true }).click();
    await page.waitForURL(`${origin}/life/`);
    await search("Axios");
    check(new URL(page.url()).pathname === "/life/" && await count() === 0, "일상 검색에 기술 글 미노출");
    await page.getByRole("link", { name: "검색 해제", exact: true }).click();
    await page.waitForURL(`${origin}/life/`);
    await page.goBack();
    check(new URL(page.url()).searchParams.get("q") === "Axios", "뒤로가기 검색 복원");
    await page.goForward();
    check(!new URL(page.url()).searchParams.has("q"), "앞으로가기 검색 해제 복원");
    report.passed.push("전체·분류 검색과 해제, 동일 경로 검색 초기화, 뒤로/앞으로가기");
    for (const [path, expected] of [["/?category=life", homeCount], ["/tech/?category=life", homeCount], ["/life/?category=tech", 0]]) {
      await go(path); check(await count() === expected, "전용 목록이 충돌 query보다 우선");
    }
    await go("/posts/?category=life");
    await page.waitForFunction(() => document.querySelector('nav[aria-label="메인 메뉴"] a[aria-current="page"]')?.textContent === "일상");
    check(await count() === 0, "legacy 일상 목록 호환");
    await search("Axios");
    check(new URL(page.url()).pathname === "/posts/" && new URL(page.url()).searchParams.get("category") === "life", "legacy 검색 범위 호환");
    await go("/posts/"); check(await count() === homeCount, "legacy 기본 기술 목록");
    await go("/posts/axios-cancel/");
    check(JSON.stringify(await active()) === JSON.stringify(["기술"]), "상세 글의 기술 활성 상태");
    await page.locator(".post-image-trigger").first().click();
    await page.locator("dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("dialog").waitFor({ state: "detached" });
    await search("Axios");
    check(new URL(page.url()).pathname === "/tech/", "상세 글에서 같은 분류 검색");
    const sitemap = await (await page.request.get(`${origin}/sitemap.xml`)).text();
    for (const path of ["/", "/tech/", "/life/", "/posts/axios-cancel/"]) check(sitemap.includes(`<loc>${origin}${path}</loc>`), `사이트맵 ${path}`);
    report.passed.push("충돌 query, legacy 목록·검색, 상세 메뉴·검색·이미지 확대, 사이트맵");
    await go("/");
    await nav.getByRole("link", { name: "기술", exact: true }).focus();
    await page.keyboard.press("Enter"); await page.waitForURL(`${origin}/tech/`);
    await page.getByRole("button", { name: "글 검색", exact: true }).focus();
    await page.keyboard.press("Enter");
    check(await input.evaluate((node) => document.activeElement === node), "검색 입력 자동 포커스");
    await page.keyboard.press("Escape");
    check(await page.getByRole("button", { name: "글 검색", exact: true }).evaluate((node) => document.activeElement === node), "검색 ESC 포커스 복귀");
    for (const [width, height, theme] of [[320, 740, "light"], [375, 812, "dark"], [1200, 900, "light"]]) {
      await page.setViewportSize({ width, height });
      await go("/");
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 가로 스크롤 없음`);
      const boxes = await nav.locator("a,button").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
      check(boxes.every((box) => box.left >= 0 && box.right <= width), "메뉴가 화면 안에 표시");
      check(boxes.every((box, index) => !index || box.left >= boxes[index - 1].right - 1), "메뉴와 도구가 겹치지 않음");
      const path = `/Users/langdy-45/personal/dahm-blog/.playwright-mcp/top-navigation-${width}.png`;
      await page.screenshot({ path }); report.screenshots.push(path);
      await page.getByRole("button", { name: "글 검색", exact: true }).click();
      check(await input.isVisible(), "작은 화면 검색 입력 표시");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "검색을 열어도 가로 스크롤 없음");
      await page.keyboard.press("Escape");
    }
    report.passed.push("키보드 메뉴·검색·ESC 포커스, 320/375/1200px 양 테마·검색·헤더 배치");
    check(consoleErrors.length === 0, `브라우저 오류: ${consoleErrors.join("; ")}`);
    await page.setViewportSize({ width: 1200, height: 900 }); await go("/");
  } catch (error) { report.errors.push(error.message); }
  finally { page.off("pageerror", listener); }
  return report;
}
