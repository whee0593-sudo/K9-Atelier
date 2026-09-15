"use client";

import Image from "next/image";
import React from "react";
import { GalleryWallCaption } from "@/components/gallery/GalleryCaption";
import {
  GALLERY_FRAME_SLOTS,
  GALLERY_SECTION_WIDTH_VH,
  SELECTED_WORK_CAPTIONS,
  SELECTED_WORK_PRIORITY_IDS,
  type GalleryFrameSlot,
  workLightboxId,
} from "@/lib/gallery-wall";

export function SelectedWorkSection({
  onOpen,
}: {
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  return (
    <section
      className="k9-gallery-selected"
      aria-label="Selected Work"
      style={{ width: `${GALLERY_SECTION_WIDTH_VH.selected}vh` }}
    >
      <div
        className="k9-gallery-section-title"
        style={{ left: "2.4vh", top: "6.5%" }}
      >
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.28em] text-champagne/70">
          Selected Work
        </p>
        <p className="font-display mt-2 text-[1.05rem] italic text-ivory/50">
          A Study in Coat &amp; Form
        </p>
      </div>
      {GALLERY_FRAME_SLOTS.map((slot) => (
        <FramedArtwork
          key={slot.id}
          slot={slot}
          onOpen={onOpen}
          priority={SELECTED_WORK_PRIORITY_IDS.has(slot.id)}
        />
      ))}
    </section>
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
    <button
      type="button"
      aria-label={`View larger: ${slot.photoAlt}`}
      onClick={(event) => onOpen(workLightboxId(slot.id), event.currentTarget)}
      className="k9-gallery-art group focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne"
      style={{
        left: `${slot.centerX}vh`,
        top: `${slot.centerY}%`,
        width: `${slot.displayWidth}vh`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="block overflow-visible transition duration-[350ms] ease-out [filter:drop-shadow(0_10px_18px_rgba(0,0,0,0.30))] hover:z-20 group-hover:scale-[1.012] group-hover:[filter:drop-shadow(0_14px_22px_rgba(0,0,0,0.38))_drop-shadow(0_0_10px_rgba(185,151,98,0.14))] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        <Image
          src={slot.photoSrc}
          alt={slot.photoAlt}
          width={slot.photoWidth}
          height={slot.photoHeight}
          sizes="(max-width: 767px) 32vw, (max-width: 1099px) 18vw, 16vw"
          quality={90}
          priority={priority}
          unoptimized
          draggable={false}
          className="h-auto w-full bg-transparent object-contain"
        />
      </span>
      <GalleryWallCaption caption={SELECTED_WORK_CAPTIONS[slot.id] ?? { kicker: "SELECTED WORK", detail: "" }} />
    </button>
  );
}
