import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ZoomableImage, ZoomableImageLink } from "../../src/components/ZoomableImage";

const portrait = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="1200"><rect width="300" height="1200" fill="#0f766e"/></svg>')}`;

createRoot(document.getElementById("fixture")!).render(
  <StrictMode>
    <main className="content" style={{ padding: 24 }}>
      <p><ZoomableImage src={portrait} alt="세로 사진" width={75} height={300} /></p>
      <p><ZoomableImageLink href="#original"><ZoomableImage src={portrait} alt="링크 사진" width={75} height={300} /></ZoomableImageLink></p>
      <p><ZoomableImage src="/__image-lightbox-qa__/missing.png" alt="실패 사진" /></p>
    </main>
  </StrictMode>,
);
