import Image from "next/image";
import { GALLERY_FRAME_SLOTS, GALLERY_WALL } from "@/lib/gallery-wall";

export function GalleryWall() {
  return (
    <div className="relative w-full">
      <Image
        src={GALLERY_WALL.src}
        alt={GALLERY_WALL.alt}
        width={GALLERY_WALL.width}
        height={GALLERY_WALL.height}
        sizes="100vw"
        quality={90}
        priority
        className="block h-auto w-full max-w-none"
        style={{ width: "100%", height: "auto" }}
      />
      <div className="absolute inset-0">
        {GALLERY_FRAME_SLOTS.map((slot) => {
          if (!slot.photoSrc) return null;
          const scale = slot.photoScale ?? 1;
          const framed = slot.fit === "framed";
          return (
            <div
              key={slot.id}
              data-gallery-slot={slot.id}
              className={
                framed
                  ? "absolute overflow-visible"
                  : slot.shape === "oval"
                    ? "absolute overflow-hidden rounded-[50%]"
                    : "absolute overflow-hidden"
              }
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
              }}
            >
              <div className="relative flex h-full w-full items-center justify-center">
                <div
                  className="relative"
                  style={{
                    width: `${scale * 100}%`,
                    height: `${scale * 100}%`,
                  }}
                >
                  <Image
                    src={slot.photoSrc}
                    alt={slot.photoAlt ?? `Gallery photo ${slot.id}`}
                    fill
                    sizes="(max-width: 768px) 28vw, 16vw"
                    quality={90}
                    className={framed ? "object-contain" : "object-cover"}
                    style={{
                      objectPosition: slot.photoPosition ?? "center center",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
