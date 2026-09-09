"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  GALLERY_FRAME_SLOTS,
  GALLERY_WALL,
  type GalleryFrameSlot,
} from "@/lib/gallery-wall";

const ABOVE_FOLD_IDS = new Set([1, 4, 5]);

export function GalleryWall() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const openSlot = (slot: GalleryFrameSlot, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger;
    setActiveId(slot.id);
  };

  const closeLightbox = useCallback(() => {
    setActiveId(null);
    lastTriggerRef.current?.focus();
  }, []);

  return (
    <>
      <MuseumWall onOpen={openSlot} />
      <MobileGallery onOpen={openSlot} />
      {activeId !== null && (
        <GalleryLightbox
          activeId={activeId}
          onActiveIdChange={setActiveId}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}

function MuseumWall({
  onOpen,
}: {
  onOpen: (slot: GalleryFrameSlot, trigger: HTMLElement) => void;
}) {
  return (
    <div className="relative hidden w-full overflow-visible md:block">
      <Image
        src={GALLERY_WALL.src}
        alt={GALLERY_WALL.alt}
        width={GALLERY_WALL.width}
        height={GALLERY_WALL.height}
        sizes="100vw"
        quality={90}
        priority
        className="block h-auto w-full max-w-none"
      />
      <div className="absolute inset-0 overflow-visible">
        {GALLERY_FRAME_SLOTS.map((slot) => (
          <FramedArtwork
            key={slot.id}
            slot={slot}
            onOpen={onOpen}
            priority={ABOVE_FOLD_IDS.has(slot.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FramedArtwork({
  slot,
  onOpen,
  priority,
}: {
  slot: GalleryFrameSlot;
  onOpen: (slot: GalleryFrameSlot, trigger: HTMLElement) => void;
  priority: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`View larger: ${slot.photoAlt}`}
      onClick={(event) => onOpen(slot, event.currentTarget)}
      className="group absolute z-10 overflow-visible bg-transparent p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne focus-visible:ring-offset-0 hover:z-20"
      style={{
        left: `${slot.centerX}%`,
        top: `${slot.centerY}%`,
        width: `${slot.displayWidth}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="block overflow-visible transition duration-[350ms] ease-out [filter:drop-shadow(0_10px_18px_rgba(0,0,0,0.30))] group-hover:scale-[1.02] group-hover:[filter:drop-shadow(0_14px_22px_rgba(0,0,0,0.38))_drop-shadow(0_0_12px_rgba(185,151,98,0.16))] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        <Image
          src={slot.photoSrc}
          alt={slot.photoAlt}
          width={slot.photoWidth}
          height={slot.photoHeight}
          sizes="(min-width: 768px) 16vw, 46vw"
          quality={90}
          priority={priority}
          className="h-auto w-full object-contain"
        />
      </span>
    </button>
  );
}

function MobileGallery({
  onOpen,
}: {
  onOpen: (slot: GalleryFrameSlot, trigger: HTMLElement) => void;
}) {
  return (
    <div className="px-4 pb-4 pt-2 min-[380px]:px-5 md:hidden">
      <div className="columns-1 gap-3 min-[380px]:columns-2 min-[380px]:gap-4">
        {GALLERY_FRAME_SLOTS.map((slot, index) => (
          <button
            key={slot.id}
            type="button"
            aria-label={`View larger: ${slot.photoAlt}`}
            onClick={(event) => onOpen(slot, event.currentTarget)}
            className="mb-3 block w-full break-inside-avoid bg-transparent p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne min-[380px]:mb-4"
          >
            <Image
              src={slot.photoSrc}
              alt={slot.photoAlt}
              width={slot.photoWidth}
              height={slot.photoHeight}
              sizes="(max-width: 379px) 92vw, 46vw"
              quality={90}
              priority={index < 2}
              className="h-auto w-full object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function GalleryLightbox({
  activeId,
  onActiveIdChange,
  onClose,
}: {
  activeId: number;
  onActiveIdChange: (id: number) => void;
  onClose: () => void;
}) {
  const labelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const slot =
    GALLERY_FRAME_SLOTS.find((item) => item.id === activeId) ??
    GALLERY_FRAME_SLOTS[0];

  const goPrev = useCallback(() => {
    onActiveIdChange(((activeId + 15) % 17) + 1);
  }, [activeId, onActiveIdChange]);

  const goNext = useCallback(() => {
    onActiveIdChange((activeId % 17) + 1);
  }, [activeId, onActiveIdChange]);

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

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 p-4 sm:p-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 id={labelId} className="sr-only">
        {slot.photoAlt}
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
        aria-label="Previous portrait"
        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 px-3 py-6 text-4xl font-light text-ivory/55 transition hover:text-ivory focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne sm:left-6"
      >
        ‹
      </button>
      <Image
        src={slot.photoSrc}
        alt={slot.photoAlt}
        width={slot.photoWidth}
        height={slot.photoHeight}
        quality={90}
        priority
        sizes="90vw"
        className="h-auto max-h-[84vh] w-auto max-w-[min(92vw,56rem)] object-contain"
      />
      <button
        type="button"
        onClick={goNext}
        aria-label="Next portrait"
        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 px-3 py-6 text-4xl font-light text-ivory/55 transition hover:text-ivory focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne sm:right-6"
      >
        ›
      </button>
    </div>
  );
}
