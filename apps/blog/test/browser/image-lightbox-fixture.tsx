import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ZoomableImage, ZoomableImageLink } from "../../src/components/ZoomableImage";

const portrait = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="1200"><rect width="300" height="1200" fill="#0f766e"/></svg>')}`;
const landscape = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#0f766e"/></svg>')}`;

createRoot(document.getElementById("fixture")!).render(
  <StrictMode>
    <main className="content" style={{ padding: 24 }}>
      <p><ZoomableImage src={portrait} alt="세로 사진" width={75} height={300} /></p>
      <p><ZoomableImageLink href="#original"><ZoomableImage src={portrait} alt="링크 사진" width={75} height={300} /></ZoomableImageLink></p>
      <p><ZoomableImage src={landscape} data-original-src="/__image-lightbox-qa__/original.svg" data-original-width="2400" data-original-height="1200" alt="CDN 사진" /></p>
      <p><ZoomableImage src={portrait} data-original-src="/__image-lightbox-qa__/slow-original.svg" data-original-width="600" data-original-height="2400" alt="느린 원본 사진" /></p>
      <p><ZoomableImage src={landscape} data-original-src="/__image-lightbox-qa__/missing.png" data-original-width="1200" data-original-height="600" alt="실패 사진" /></p>
      <p id="caption-width"><ZoomableImage src={landscape} alt="로그인 화면 {width=360}" /></p>
      <p id="caption-only-width"><ZoomableImage src={landscape} alt="{width=360}" /></p>
      <p id="caption-auto"><ZoomableImage src={landscape} alt="자동 크기 사진" /></p>
      <p id="caption-small"><ZoomableImage src={portrait} width={75} height={300} alt={"긴 캡션 ".repeat(30)} /></p>
      <p id="caption-link"><ZoomableImageLink href="#original"><ZoomableImage src={landscape} alt="링크 화면 {width=360}" /></ZoomableImageLink></p>
    </main>
  </StrictMode>,
);
