import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";
import { siteConfig } from "../../src/lib/site.ts";

const brand = "dahm-lee";
const font = readFile(new URL("../../assets/fonts/Pretendard-SemiBold.woff", import.meta.url));

export function socialImageElement({ title, hostname }) {
  const isPost = title !== undefined;
  // 한글과 영문의 폭 차이를 반영해 긴 제목에도 충분한 줄바꿈 공간을 둔다.
  const textWidth = Array.from(title ?? "").reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : 0.6), 0);
  const titleSize = Math.min(66, Math.floor(Math.sqrt(1020 * 260 / Math.max(textWidth * 1.5, 1))));
  return h("div", {
    style: {
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      padding: "80px 90px 64px", background: "#faf9f6", color: "#111111",
      fontFamily: "Pretendard", fontWeight: 600,
    },
  },
  h("div", { style: { display: "flex", height: 40, fontSize: isPost ? 20 : 19, color: isPost ? "#111111" : "#777777", letterSpacing: isPost ? 0 : 3 } }, isPost ? brand : `${brand} / journal`),
  h("div", { style: { display: "flex", flex: 1, alignItems: "center" } },
    h("div", { style: { display: "flex", width: "100%", fontSize: isPost ? titleSize : 108, lineHeight: 1.35, textAlign: "left", wordBreak: "keep-all", letterSpacing: isPost ? -1 : -4 } }, title ?? brand)),
  h("div", { style: { display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e2e2", paddingTop: 24, fontSize: 23, color: "#888888" } },
    h("span", null, isPost ? hostname : "글과 선택의 기록."),
    isPost ? null : h("span", null, hostname)));
}

export async function renderSocialImage(options) {
  const response = new ImageResponse(socialImageElement(options), {
    width: siteConfig.socialImage.width,
    height: siteConfig.socialImage.height,
    fonts: [{ name: "Pretendard", data: await font, weight: 600, style: "normal" }],
  });
  return Buffer.from(await response.arrayBuffer());
}
