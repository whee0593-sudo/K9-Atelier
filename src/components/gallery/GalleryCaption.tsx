import React from "react";
import {
  lightboxCaptionLines,
  type GalleryCaption as GalleryCaptionData,
} from "@/lib/gallery-wall";

export function GalleryLightboxCaption({
  caption,
}: {
  caption?: GalleryCaptionData;
}) {
  const [breed, styling] = lightboxCaptionLines(caption);
  return (
    <figcaption className="k9-gallery-lightbox-caption">
      {breed ? <p className="font-display text-ivory/80">{breed}</p> : null}
      {styling ? <p className="font-display text-ivory/80">{styling}</p> : null}
    </figcaption>
  );
}

export function GalleryWallCaption({
  caption,
}: {
  caption: GalleryCaptionData;
}) {
  const [breed, styling] = lightboxCaptionLines(caption);
  if (!breed && !styling) return null;
  return (
    <span className="k9-gallery-caption">
      {breed ? <span className="k9-gallery-caption-kicker">{breed}</span> : null}
      {styling ? (
        <span className="k9-gallery-caption-detail">{styling}</span>
      ) : null}
    </span>
  );
}
