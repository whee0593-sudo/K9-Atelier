"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { GALLERY_FRAME_SLOTS, galleryImage } from "@/lib/gallery-wall";

export function GalleryWall() {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") setActive((active % 17) + 1);
      if (event.key === "ArrowLeft") setActive(((active + 15) % 17) + 1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  return (
    <>
      <div className="overflow-x-auto bg-[#0d110b] py-4 sm:py-8">
        <div
          className="relative mx-auto min-w-[760px] max-w-[1500px] overflow-hidden border-y border-[#8b6b35]/30 bg-[#171d14] shadow-[inset_0_0_100px_rgba(0,0,0,.72)]"
          style={{ aspectRatio: "3 / 2" }}
        >
          <div className="absolute inset-0 opacity-70 [background:radial-gradient(ellipse_at_12%_0%,rgba(230,198,128,.16),transparent_24%),radial-gradient(ellipse_at_43%_0%,rgba(230,198,128,.13),transparent_23%),radial-gradient(ellipse_at_69%_0%,rgba(230,198,128,.13),transparent_23%),radial-gradient(ellipse_at_91%_0%,rgba(230,198,128,.14),transparent_22%),linear-gradient(180deg,#1c2419_0%,#11170f_82%,#0b0e09_100%)]" />
          <div className="absolute inset-x-0 bottom-[5.2%] h-[1.2%] bg-[#80613b] shadow-[0_-2px_8px_rgba(0,0,0,.6)]" />
          <div className="absolute inset-x-0 bottom-0 h-[5.2%] bg-[linear-gradient(180deg,#241a12,#120e0b)]" />

          {GALLERY_FRAME_SLOTS.map((slot) => (
            <button
              key={slot.id}
              type="button"
              aria-label={`View grooming portrait ${slot.id}`}
              onClick={() => setActive(slot.id)}
              className="group absolute z-10 flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c7a86a]"
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}
            >
              <Image
                src={galleryImage(slot.id)}
                alt={`K9 Atelier grooming portrait ${slot.id}`}
                fill
                sizes="(max-width: 768px) 18vw, 14vw"
                className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.025]"
              />
            </button>
          ))}
        </div>
      </div>

      {active !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Gallery portrait ${active}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-10"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActive(null); }}
        >
          <button type="button" onClick={() => setActive(null)} aria-label="Close gallery" className="absolute right-5 top-5 z-20 text-3xl font-light text-white/80 transition hover:text-white">×</button>
          <button type="button" onClick={() => setActive(((active + 15) % 17) + 1)} aria-label="Previous portrait" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 px-3 py-6 text-4xl font-light text-white/65 transition hover:text-white sm:left-8">‹</button>
          <div className="relative h-[84vh] w-[84vw] max-w-5xl">
            <Image src={galleryImage(active)} alt={`K9 Atelier grooming portrait ${active}`} fill priority sizes="90vw" className="object-contain" />
          </div>
          <button type="button" onClick={() => setActive((active % 17) + 1)} aria-label="Next portrait" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 px-3 py-6 text-4xl font-light text-white/65 transition hover:text-white sm:right-8">›</button>
        </div>
      )}
    </>
  );
}
