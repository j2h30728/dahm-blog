async (page) => {
  const report = { passed: [], measurements: [] };
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.goto("http://127.0.0.1:3037/posts/axios-cancel/", { waitUntil: "networkidle" });
  const css = await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.href));
  const bundle = await page.request.get("http://127.0.0.1:3037/__image-lightbox-qa__/fixture.js");
  check(bundle.ok(), "최신 fixture bundle 필요");
  const script = await bundle.text();
  const routePattern = "**/__image-lightbox-qa__/**";
  await page.route(routePattern, route => {
    if (route.request().url().endsWith("fixture.js")) return route.fulfill({ contentType: "application/javascript", body: script });
    if (route.request().url().endsWith("missing.png")) return route.fulfill({ status: 404, body: "missing" });
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1">${css.map(href => `<link rel="stylesheet" href="${href}">`).join("")}</head><body><div id="fixture"></div><script src="/__image-lightbox-qa__/fixture.js"></script></body></html>` });
  });
  try {
    await page.goto("http://127.0.0.1:3037/__image-lightbox-qa__/", { waitUntil: "networkidle" });
    await page.locator("#caption-width img").evaluate(img => img.decode());
    for (const viewport of [{ width: 1200, height: 900 }, { width: 320, height: 700 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      const measured = await page.evaluate(() => {
        const width = id => document.querySelector(`#${id} img`).getBoundingClientRect().width;
        const image = document.querySelector("#caption-width img");
        const box = image.getBoundingClientRect();
        const parentWidth = document.querySelector("#caption-width").getBoundingClientRect().width;
        return { viewport: innerWidth, parentWidth, specified: box.width, height: box.height,
          onlyWidth: width("caption-only-width"), automatic: width("caption-auto"), small: width("caption-small"), linked: width("caption-link"),
          noOverflow: document.documentElement.scrollWidth <= innerWidth,
          caption: document.querySelector("#caption-width .post-image-caption").textContent,
          noEmptyCaption: !document.querySelector("#caption-only-width .post-image-caption"),
          cleanAlt: image.alt === "로그인 화면",
        };
      });
      check(Math.abs(measured.specified - Math.min(360, measured.parentWidth)) < 2, "지정 너비와 모바일 축소");
      check(Math.abs(measured.height / measured.specified - 0.5) < 0.02, "높이 비율 유지");
      check(Math.abs(measured.onlyWidth - measured.specified) < 2 && Math.abs(measured.linked - measured.specified) < 2, "크기만·링크 안 이미지도 동일 규칙");
      check(Math.abs(measured.automatic - measured.parentWidth) < 2, "너비 생략 시 자동 크기");
      check(Math.abs(measured.small - 75) < 2, "긴 캡션이 작은 이미지 너비를 늘리지 않음");
      check(measured.noOverflow && measured.cleanAlt && measured.noEmptyCaption && measured.caption === "로그인 화면", "크기 표기 숨김·빈 캡션 생략·넘침 없음");
      report.measurements.push(measured);
    }
    report.passed.push("1200/320/375px: 지정 폭·자동 폭·비율·긴 캡션·링크·표기 숨김");
    const trigger = page.locator("#caption-width button");
    await trigger.click();
    await page.locator("dialog[open] img").evaluate(img => img.decode());
    check(await page.locator("dialog img").getAttribute("width") === "1200", "확대창이 표시 폭 대신 원본 해상도 사용");
    await page.keyboard.press("Escape");
    await page.locator("dialog").waitFor({ state: "detached" });
    check(await trigger.evaluate(node => document.activeElement === node), "ESC 후 포커스 복원");
    await page.locator("#caption-link a").click();
    await page.locator("dialog[open]").waitFor();
    await page.mouse.click(2, 2);
    await page.locator("dialog").waitFor({ state: "detached" });
    report.passed.push("지정 폭 이미지 확대·원본 비율·ESC·포커스 복원·링크 확대·바깥 클릭");
    return report;
  } finally {
    await page.unroute(routePattern);
    await page.goto("http://127.0.0.1:3037/posts/axios-cancel/", { waitUntil: "domcontentloaded" });
  }
}
