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
  const [kicker, detail] = lightboxCaptionLines(caption);
  return (
    <figcaption className="k9-gallery-lightbox-caption">
      <p className="font-body text-champagne/80">{kicker}</p>
      <p className="font-display text-ivory/80">{detail}</p>
    </figcaption>
  );
}

export function GalleryWallCaption({
  caption,
}: {
  caption: GalleryCaptionData;
}) {
  const detail = caption.detail?.trim() ?? "";
  if (!detail) return null;
  return (
    <span className="k9-gallery-caption">
      <span className="k9-gallery-caption-detail">{detail}</span>
    </span>
  );
}
