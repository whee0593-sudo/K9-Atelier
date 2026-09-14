"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  getLightboxItem,
  lightboxCaptionLines,
  nextLightboxId,
  prevLightboxId,
} from "@/lib/gallery-wall";

export function GalleryLightbox({
  activeId,
  onActiveIdChange,
  onClose,
}: {
  activeId: string;
  onActiveIdChange: (id: string) => void;
  onClose: () => void;
}) {
  const labelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [imageMissing, setImageMissing] = useState(false);
  const item = getLightboxItem(activeId) ?? getLightboxItem("work-01");
  const captionLines = lightboxCaptionLines(item?.caption);

  const goPrev = useCallback(() => {
    onActiveIdChange(prevLightboxId(activeId));
  }, [activeId, onActiveIdChange]);

  const goNext = useCallback(() => {
    onActiveIdChange(nextLightboxId(activeId));
  }, [activeId, onActiveIdChange]);

  useEffect(() => {
    setImageMissing(false);
  }, [activeId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [goNext, goPrev, onClose]);

  if (!item) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/88 p-4 sm:p-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 id={labelId} className="sr-only">
        {item.alt}
      </h2>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close gallery"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center text-[2rem] font-light leading-none text-ivory/80 transition hover:text-ivory focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne sm:right-6 sm:top-6"
      >
        ×
      </button>
      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous image"
        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 px-3 py-6 text-4xl font-light text-ivory/55 transition hover:text-ivory focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne sm:left-6"
      >
        ‹
      </button>
      {imageMissing ? (
        <div className="flex h-[min(70vh,28rem)] w-[min(92vw,36rem)] items-center justify-center border border-champagne/20 bg-[#11120a]">
          <p className="font-body px-6 text-center text-[11px] uppercase tracking-[0.18em] text-ivory/45">
            Photograph not yet available
          </p>
        </div>
      ) : (
        <Image
          src={item.src}
          alt={item.alt}
          width={item.width}
          height={item.height}
          quality={90}
          priority
          sizes="90vw"
          className="h-auto max-h-[78vh] w-auto max-w-[min(92vw,56rem)] object-contain"
          onError={() => setImageMissing(true)}
        />
      )}
      {captionLines.length > 0 && (
        <div className="mt-5 text-center">
          {captionLines.map((line, index) => (
            <p
              key={line}
              className={
                index === 0
                  ? "font-body text-[11px] tracking-[0.16em] text-champagne/75"
                  : "font-display mt-1 text-[1.05rem] text-ivory/70"
              }
            >
              {line}
            </p>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={goNext}
        aria-label="Next image"
        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 px-3 py-6 text-4xl font-light text-ivory/55 transition hover:text-ivory focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne sm:right-6"
      >
        ›
      </button>
    </div>
  );
}
