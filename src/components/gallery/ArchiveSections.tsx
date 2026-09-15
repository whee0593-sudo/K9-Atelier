"use client";

import Image from "next/image";
import React, { useState } from "react";
import { GalleryWallCaption } from "@/components/gallery/GalleryCaption";
import {
  COMPETITION_ARCHIVE_ITEMS,
  GALLERY_SECTION_WIDTH_VH,
  GALLERY_WINNER_ITEM_ID,
  GALLERY_WINNER_PLAQUE,
  competitionPlacement,
  type CompetitionArchiveItem,
  type CompetitionFrameFinish,
} from "@/lib/gallery-wall";

const FRAME_CLASS: Record<CompetitionFrameFinish, string> = {
  gold: "k9-gallery-frame-gold",
  walnut: "k9-gallery-frame-walnut",
  brass: "k9-gallery-frame-brass",
};

export function CompetitionArchiveSection({
  onOpen,
}: {
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  return (
    <section
      className="k9-gallery-competition"
      aria-label="The Craft"
      style={{ width: `${GALLERY_SECTION_WIDTH_VH.competition}vh` }}
    >
      <div
        className="k9-gallery-section-title"
        style={{ left: "2.4vh", top: "7%", maxWidth: "20rem" }}
      >
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.28em] text-champagne/70">
          The Craft
        </p>
        <p className="font-display mt-2 text-[1.05rem] italic leading-snug text-ivory/50">
          Awards, teaching moments, and memories from the show ring.
        </p>
      </div>
      {COMPETITION_ARCHIVE_ITEMS.map((item) => (
        <ArchiveFrame key={item.id} item={item} onOpen={onOpen} />
      ))}
      <MuseumLabel />
    </section>
  );
}

function ArchiveFrame({
  item,
  onOpen,
}: {
  item: CompetitionArchiveItem;
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  const [missing, setMissing] = useState(false);
  const place = competitionPlacement(item);

  return (
    <button
      type="button"
      aria-label={
        missing
          ? `${item.alt} (photograph not yet available)`
          : `View larger: ${item.alt}`
      }
      disabled={missing}
      onClick={(event) => onOpen(item.id, event.currentTarget)}
      className="k9-gallery-archive group focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne disabled:cursor-default"
      style={{
        left: `${place.x}vh`,
        top: `${place.y}%`,
        width: `${place.displayWidth}vh`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span
        className={`k9-gallery-frame ${FRAME_CLASS[item.frame]} overflow-visible transition duration-[350ms] ease-out group-hover:scale-[1.012] group-hover:[filter:drop-shadow(0_12px_18px_rgba(0,0,0,0.36))] motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
      >
        {missing ? (
          <span className="k9-gallery-archive-missing" />
        ) : (
          <Image
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes="(max-width: 767px) 42vw, 22vw"
            quality={90}
            draggable={false}
            className="k9-gallery-archive-image"
            onError={() => setMissing(true)}
          />
        )}
      </span>
      {item.id === GALLERY_WINNER_ITEM_ID ? null : (
        <GalleryWallCaption caption={item.caption} />
      )}
    </button>
  );
}

function MuseumLabel() {
  return (
    <div
      className="k9-gallery-plaque"
      style={{
        left: `${GALLERY_WINNER_PLAQUE.x}vh`,
        top: `${GALLERY_WINNER_PLAQUE.y}%`,
        width: "12vh",
        transform: "translate(-50%, -50%)",
      }}
    >
      <p className="font-body text-[9px] uppercase tracking-[0.22em] text-champagne/80">
        {GALLERY_WINNER_PLAQUE.year}
      </p>
      <p className="font-body mt-1.5 text-[9px] uppercase tracking-[0.2em] text-champagne">
        {GALLERY_WINNER_PLAQUE.title}
      </p>
      <p className="font-display mt-1.5 text-[0.95rem] text-ivory/75">
        {GALLERY_WINNER_PLAQUE.detail}
      </p>
    </div>
  );
}
