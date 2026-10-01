"use client";

import Image from "next/image";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GalleryWallCaption } from "@/components/gallery/GalleryCaption";
import {
  GALLERY_FRAME_SLOTS,
  SELECTED_WORK_CAPTIONS,
  type GalleryFrameSlot,
  workLightboxId,
} from "@/lib/gallery-wall";

/** First row only. The second row is inside the initial mobile viewport, so it stays lazy rather than preloaded. */
const PRIORITY_COUNT = 2;

/**
 * Later rows are below that viewport. Native lazy loading and
 * content-visibility:auto still request them on this short page, so those
 * rows stay content-visibility:hidden until they are within one row of the
 * screen. The img markup stays in the document; only the fetch is delayed.
 */
const DEFERRED_ROW_START = 2;
const DEFERRED_ROW_MARGIN = "240px 0px";

/**
 * Card width in the two-column gallery.
 * <640: page padding 2rem + 1rem gap. ~182px at a 412px viewport.
 * 640–767: 2rem padding + 2rem gap.
 * 768–1279: 6rem padding + 3.5rem gap.
 * ≥1280: 1240px container, 10rem padding + 3.5rem gap = 512px.
 */
const GALLERY_IMAGE_SIZES =
  "(max-width: 639px) calc((100vw - 3rem) / 2), (max-width: 767px) calc((100vw - 4rem) / 2), (max-width: 1279px) calc((100vw - 9.5rem) / 2), 512px";

function galleryRows() {
  const rows: GalleryFrameSlot[][] = [];
  for (let index = 0; index < GALLERY_FRAME_SLOTS.length; index += 2) {
    rows.push(GALLERY_FRAME_SLOTS.slice(index, index + 2));
  }
  return rows;
}

export function SelectedWorkSection({
  onOpen,
}: {
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  return (
    <div className="flex flex-col gap-y-10 sm:gap-y-14 md:gap-y-16">
      {galleryRows().map((row, rowIndex) => (
        <GalleryRow key={row[0]?.id ?? rowIndex} row={row} rowIndex={rowIndex} onOpen={onOpen} />
      ))}
    </div>
  );
}

function GalleryRow({
  row,
  rowIndex,
  onOpen,
}: {
  row: GalleryFrameSlot[];
  rowIndex: number;
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const defer = rowIndex >= DEFERRED_ROW_START;
  const [revealed, setRevealed] = useState(!defer);
  const [intrinsic, setIntrinsic] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!defer || revealed) return;
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const visible = document.querySelector("ul.grid");
      if (!visible || visible === element) return;
      const images = [...visible.querySelectorAll("img")];
      const tallest = Math.max(
        0,
        ...images.map((image) => image.getBoundingClientRect().height),
      );
      if (tallest <= 0) return;
      const extra = visible.getBoundingClientRect().height - tallest;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      const column = (element.clientWidth - gap) / 2;
      const imageHeight = Math.max(
        ...row.map((slot) => (column * slot.photoHeight) / slot.photoWidth),
      );
      setIntrinsic(Math.ceil(imageHeight + extra));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [defer, revealed, row]);

  useEffect(() => {
    if (!defer || revealed) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: DEFERRED_ROW_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [defer, revealed]);

  return (
    <ul
      ref={ref}
      className="grid list-none grid-cols-2 gap-x-4 sm:gap-x-8 md:gap-x-14"
      style={
        defer && !revealed
          ? {
              contentVisibility: "hidden",
              containIntrinsicSize: intrinsic
                ? `auto ${intrinsic}px`
                : "auto 18rem",
            }
          : undefined
      }
    >
      {row.map((slot, columnIndex) => (
        <li key={slot.id} className="row-span-2 grid min-w-0 grid-rows-subgrid">
          <FramedArtwork
            slot={slot}
            onOpen={onOpen}
            priority={rowIndex * 2 + columnIndex < PRIORITY_COUNT}
          />
        </li>
      ))}
    </ul>
  );
}

function FramedArtwork({
  slot,
  onOpen,
  priority,
}: {
  slot: GalleryFrameSlot;
  onOpen: (id: string, trigger: HTMLElement) => void;
  priority: boolean;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`View larger: ${slot.photoAlt}`}
        onClick={(event) => onOpen(workLightboxId(slot.id), event.currentTarget)}
        className="group w-full cursor-pointer self-center text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne"
      >
        <span className="block transition duration-[350ms] ease-out [filter:drop-shadow(0_12px_22px_rgba(77,67,72,0.14))] group-hover:[filter:drop-shadow(0_18px_28px_rgba(77,67,72,0.2))] motion-reduce:transition-none">
          <Image
            src={slot.photoSrc}
            alt={slot.photoAlt}
            width={slot.photoWidth}
            height={slot.photoHeight}
            sizes={GALLERY_IMAGE_SIZES}
            quality={90}
            priority={priority}
            fetchPriority={priority ? "high" : undefined}
            draggable={false}
            className="h-auto w-full bg-transparent object-contain"
          />
        </span>
      </button>
      <GalleryWallCaption
        layout="stack"
        caption={SELECTED_WORK_CAPTIONS[slot.id] ?? { kicker: "", detail: "" }}
      />
    </>
  );
}
