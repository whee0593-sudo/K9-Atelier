"use client";

import Image from "next/image";
import React from "react";
import { GalleryWallCaption } from "@/components/gallery/GalleryCaption";
import {
  GALLERY_FRAME_SLOTS,
  SELECTED_WORK_CAPTIONS,
  type GalleryFrameSlot,
  workLightboxId,
} from "@/lib/gallery-wall";

/** First row only. The second row is below the initial mobile viewport. */
const PRIORITY_COUNT = 2;

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
        <ul
          key={row[0]?.id ?? rowIndex}
          className="grid list-none grid-cols-2 gap-x-4 sm:gap-x-8 md:gap-x-14"
        >
          {row.map((slot, columnIndex) => (
            <li
              key={slot.id}
              className="row-span-2 grid min-w-0 grid-rows-subgrid"
            >
              <FramedArtwork
                slot={slot}
                onOpen={onOpen}
                priority={rowIndex * 2 + columnIndex < PRIORITY_COUNT}
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
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
