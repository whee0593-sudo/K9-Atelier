"use client";

import Image from "next/image";
import React, { useState } from "react";
import {
  COMPETITION_WALL_ITEMS,
  CREDENTIALS_ITEMS,
  GALLERY_SECTION_WIDTH_VH,
  GALLERY_WINNER_PLAQUE,
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
      aria-label="Competition Archive"
      style={{ width: `${GALLERY_SECTION_WIDTH_VH.competition}vh` }}
    >
      <div
        className="k9-gallery-section-title"
        style={{ left: "2.4vh", top: "7%" }}
      >
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.28em] text-champagne/70">
          Competition Archive
        </p>
        <p className="font-display mt-2 max-w-[13rem] text-[1.05rem] italic leading-snug text-ivory/50">
          Teaching notes and show-day snapshots.
        </p>
      </div>
      {COMPETITION_WALL_ITEMS.map((item) => (
        <ArchiveFrame key={item.id} item={item} onOpen={onOpen} />
      ))}
      <MuseumLabel />
    </section>
  );
}

export function CredentialsSection({
  onOpen,
}: {
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  return (
    <section
      className="k9-gallery-credentials"
      aria-label="Keepsakes"
      style={{ width: `${GALLERY_SECTION_WIDTH_VH.credentials}vh` }}
    >
      <div
        className="k9-gallery-section-title"
        style={{ left: "2.8vh", top: "10%" }}
      >
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.28em] text-champagne/70">
          Keepsakes
        </p>
        <p className="font-display mt-2 max-w-[12rem] text-[1.05rem] italic leading-snug text-ivory/50">
          Ribbons and notes from the table.
        </p>
      </div>
      {CREDENTIALS_ITEMS.map((item) => (
        <ArchiveFrame key={item.id} item={item} onOpen={onOpen} />
      ))}
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
        left: `${item.x}vh`,
        top: `${item.y}%`,
        width: `${item.displayWidth}vh`,
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
