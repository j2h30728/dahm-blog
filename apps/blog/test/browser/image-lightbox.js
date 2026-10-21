async (page) => {
  const root = "/Users/langdy-45/personal/dahm-blog";
  const report = { passed: [], errors: [], screenshots: [] };
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const settle = async (target) => {
    await target.locator("dialog[open]").waitFor();
    await target.locator("dialog").evaluate(async (dialog) => {
      await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    });
  };
  const fits = async (target) => target.locator("dialog img").evaluate((image) => {
    const box = image.getBoundingClientRect();
    return image.complete && image.naturalWidth > 0 && box.width > 0 && box.height > 0 &&
      box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 &&
      Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) < 0.02;
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (route) => route.continue());
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto("http://127.0.0.1:3037/posts/axios-cancel/", { waitUntil: "networkidle" });
    const css = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.href));
    const triggers = page.locator(".content .post-image-trigger");
    check(await triggers.count() === 3, "현재 글의 이미지 3개 모두 확대 가능해야 한다");
    for (let index = 0; index < 3; index++) {
      const trigger = triggers.nth(index);
      await trigger.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => ({ y: scrollY, overflow: document.body.style.overflow, padding: document.body.style.paddingRight }));
      await trigger.click();
      await settle(page);
      await page.locator("dialog img").evaluate((img) => img.decode());
      check(await fits(page), `이미지 ${index} 화면 내 비율 유지`);
      check(await page.evaluate(() => document.body.style.overflow === "hidden"), "배경 스크롤 잠금");
      await page.locator("dialog img").click();
      check(await page.locator("dialog[open]").count() === 1, "이미지 자체 클릭은 닫지 않아야 한다");
      await page.keyboard.press("Escape");
      await page.locator("dialog").waitFor({ state: "detached" });
      check(await trigger.evaluate((node) => document.activeElement === node), "닫으면 원래 이미지로 포커스 복원");
      check(await page.evaluate((value) => Math.abs(scrollY - value.y) < 2 && document.body.style.overflow === value.overflow && document.body.style.paddingRight === value.padding, before), "스크롤 위치와 스타일 복원");
    }
    report.passed.push("실제 로컬·외부 이미지 3개, 비율, 이미지 클릭, ESC, 포커스·스크롤 복원");
    await triggers.first().focus();
    for (const key of ["Enter", "Space"]) {
      await page.keyboard.press(key);
      await settle(page);
      for (const tab of ["Tab", "Shift+Tab"]) {
        await page.keyboard.press(tab);
        check(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog"))), `${tab} 모달 내부 포커스 유지`);
      }
      await page.mouse.click(4, 4);
      await page.locator("dialog").waitFor({ state: "detached" });
    }
    report.passed.push("Enter/Space 열기, Tab/Shift+Tab, 바깥 클릭, 반복 열기");
    for (const [width, height, theme] of [[320, 568, "light"], [375, 812, "dark"], [812, 375, "light"]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
      await triggers.nth(1).click();
      await settle(page);
      check(await fits(page), `${width}x${height} 이미지 잘림 없음`);
      const closeBox = await page.getByRole("button", { name: "이미지 확대 닫기" }).boundingBox();
      check(closeBox.width >= 44 && closeBox.height >= 44 && closeBox.x + closeBox.width <= width && closeBox.y + closeBox.height <= height, "닫기 터치 영역 44px");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "가로 스크롤 없음");
      if (width === 375) {
        const path = `${root}/.playwright-mcp/image-lightbox-mobile.png`;
        await page.screenshot({ path }); report.screenshots.push(path);
      }
      await page.getByRole("button", { name: "이미지 확대 닫기" }).click();
      await page.locator("dialog").waitFor({ state: "detached" });
    }
    report.passed.push("320/375px 세로·812px 가로, 양 테마, 44px 닫기 버튼, 가로 스크롤 없음");
    const bundle = await (await page.request.get("http://127.0.0.1:3037/__image-lightbox-qa__/fixture.js")).text();
    await page.route("**/__image-lightbox-qa__/**", async (route) => {
      const url = route.request().url();
      if (url.endsWith("fixture.js")) return route.fulfill({ contentType: "application/javascript", body: bundle });
      if (url.endsWith("missing.png")) return route.fulfill({ status: 404, body: "missing" });
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ko"><head>${css.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body><div id="fixture"></div><script src="/__image-lightbox-qa__/fixture.js"></script></body></html>` });
    });
    await page.goto("http://127.0.0.1:3037/__image-lightbox-qa__/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "세로 사진 확대" }).click();
    await settle(page);
    check(await fits(page), "세로로 긴 이미지 비율·화면 유지");
    await page.keyboard.press("Escape");
    const linked = page.locator('a[aria-haspopup="dialog"]');
    check(await linked.locator("button").count() === 0, "이미지 링크에 중첩 버튼 없음");
    await linked.click(); await settle(page);
    check(!page.url().endsWith("#original"), "이미지 링크 기본 클릭은 이동 없이 확대");
    await page.keyboard.press("Escape");
    check(await linked.evaluate((node) => document.activeElement === node), "이미지 링크 포커스 복원");
    await linked.evaluate((node) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
      node.dataset.modifierPreserved = String(node.dispatchEvent(event));
    });
    check(await linked.getAttribute("data-modifier-preserved") === "true", "보조키 클릭 기본 동작 보존");
    await page.getByRole("button", { name: "실패 사진 확대" }).click(); await settle(page);
    await page.getByRole("status").waitFor();
    await page.getByRole("button", { name: "이미지 확대 닫기" }).click();
    report.passed.push("StrictMode, 긴 세로 이미지, 이미지 링크·보조키 클릭, 로딩 실패에서 닫기");
    await page.unroute("**/__image-lightbox-qa__/**");
    const touch = await page.context().browser().newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
    try {
      const mobile = await touch.newPage();
      await mobile.goto("http://127.0.0.1:3037/posts/axios-cancel/", { waitUntil: "networkidle" });
      await mobile.locator(".post-image-trigger").first().tap(); await settle(mobile);
      check(await fits(mobile), "터치 컨텍스트 확대 이미지 화면 유지");
      await mobile.touchscreen.tap(4, 4);
      await mobile.locator("dialog").waitFor({ state: "detached" });
      await mobile.locator(".post-image-trigger").nth(1).tap(); await settle(mobile);
      await mobile.getByRole("button", { name: "이미지 확대 닫기" }).tap();
      await mobile.locator("dialog").waitFor({ state: "detached" });
      report.passed.push("모바일 터치: 이미지 열기·바깥 터치·닫기 버튼");
    } finally { await touch.close(); }
    check(errors.length === 0, `브라우저 오류: ${errors.join("; ")}`);
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto("http://127.0.0.1:3037/posts/axios-cancel/", { waitUntil: "networkidle" });
    await page.locator(".post-image-trigger").nth(1).click(); await settle(page);
    const desktop = `${root}/.playwright-mcp/image-lightbox-desktop.png`;
    await page.screenshot({ path: desktop }); report.screenshots.push(desktop);
    await page.keyboard.press("Escape");
  } catch (error) { report.errors.push(error.message); }
  return report;
}
