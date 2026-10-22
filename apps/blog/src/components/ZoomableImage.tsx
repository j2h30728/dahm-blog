"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";

const ImageLinkContext = createContext(false);

interface SelectedImage {
  previewSrc: string;
  originalSrc: string;
  alt: string;
  previewWidth: number;
  previewHeight: number;
  originalWidth?: number;
  originalHeight?: number;
  trigger: HTMLElement;
}

function selectImage(image: HTMLImageElement, trigger: HTMLElement): SelectedImage {
  const originalWidth = Number(image.dataset.originalWidth);
  const originalHeight = Number(image.dataset.originalHeight);
  return {
    previewSrc: image.currentSrc || image.src,
    originalSrc: image.dataset.originalSrc || image.currentSrc || image.src,
    alt: image.alt,
    previewWidth: image.naturalWidth,
    previewHeight: image.naturalHeight,
    originalWidth: originalWidth > 0 ? originalWidth : undefined,
    originalHeight: originalHeight > 0 ? originalHeight : undefined,
    trigger,
  };
}

export function ZoomableImage(props: ComponentPropsWithoutRef<"img">) {
  const insideLink = useContext(ImageLinkContext);
  if (!props.src) return <img {...props} alt={props.alt ?? ""} />;

  const originalCaption = props.alt ?? "";
  const match = /\s*\{width=(\d{1,5})\}\s*$/u.exec(originalCaption);
  const requestedWidth = match ? Number(match[1]) : 0;
  const width = requestedWidth > 0 && requestedWidth <= 10_000 ? requestedWidth : undefined;
  const caption = width ? originalCaption.slice(0, match!.index).trim() : originalCaption;
  const imageProps = {
    ...props,
    alt: caption,
    sizes: width ? `(max-width: ${width}px) 100vw, ${width}px` : props.sizes,
  };
  const image = insideLink ? <img {...imageProps} /> : <StandaloneImage {...imageProps} />;

  if (!caption.trim() && !width) return image;
  return (
    <span className="post-image-frame" style={width ? { width } : undefined} data-image-width={width}>
      {image}
      {caption.trim() ? <span className="post-image-caption">{caption}</span> : null}
    </span>
  );
}

function StandaloneImage(props: ComponentPropsWithoutRef<"img">) {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  return (
    <>
      <button
        type="button"
        className="post-image-trigger"
        aria-haspopup="dialog"
        aria-label={`${props.alt?.trim() || "본문 이미지"} 확대`}
        onClick={(event) => {
          const image = event.currentTarget.querySelector("img");
          if (image) setSelected(selectImage(image, event.currentTarget));
        }}
      >
        <img {...props} alt={props.alt ?? ""} />
      </button>
      {selected ? (
        <ImageDialog key={`${selected.previewSrc}:${selected.originalSrc}`} image={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

export function ZoomableImageLink({ children, onClick, ...props }: ComponentPropsWithoutRef<"a">) {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  return (
    <>
      <ImageLinkContext.Provider value={true}>
        <a
          {...props}
          aria-haspopup="dialog"
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const image = event.currentTarget.querySelector("img");
            if (!image) return;
            event.preventDefault();
            setSelected(selectImage(image, event.currentTarget));
          }}
        >
          {children}
        </a>
      </ImageLinkContext.Provider>
      {selected ? (
        <ImageDialog key={`${selected.previewSrc}:${selected.originalSrc}`} image={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

function ImageDialog({ image, onClose }: { image: SelectedImage; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pointerStartedOutside = useRef(false);
  const [failed, setFailed] = useState(false);
  const [displayed, setDisplayed] = useState({
    src: image.previewSrc,
    width: image.previewWidth,
    height: image.previewHeight,
  });

  useEffect(() => {
    if (image.originalSrc === image.previewSrc) return;
    let active = true;
    const original = new Image();
    original.onload = () => {
      if (!active) return;
      setDisplayed({
        src: image.originalSrc,
        width: image.originalWidth ?? original.naturalWidth,
        height: image.originalHeight ?? original.naturalHeight,
      });
    };
    original.onerror = () => {
      if (active) setFailed(true);
    };
    original.src = image.originalSrc;
    return () => {
      active = false;
      original.onload = null;
      original.onerror = null;
    };
  }, [image]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (image.trigger.isConnected) image.trigger.focus({ preventScroll: true });
    };
  }, [image]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="post-image-dialog"
      aria-label={image.alt.trim() ? `${image.alt} 확대 보기` : "본문 이미지 확대 보기"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          closeRef.current?.focus({ preventScroll: true });
        }
      }}
      onPointerDown={(event) => {
        pointerStartedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pointerStartedOutside.current) onClose();
        pointerStartedOutside.current = false;
      }}
    >
      <button ref={closeRef} type="button" className="post-image-dialog__close" aria-label="이미지 확대 닫기" onClick={onClose}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
      <img
        className="post-image-dialog__image"
        src={displayed.src}
        alt={image.alt}
        width={displayed.width || undefined}
        height={displayed.height || undefined}
      />
      {failed ? <p className="post-image-dialog__error" role="status">원본 이미지를 불러오지 못해 미리보기를 표시합니다.</p> : null}
    </dialog>,
    document.body,
  );
}
