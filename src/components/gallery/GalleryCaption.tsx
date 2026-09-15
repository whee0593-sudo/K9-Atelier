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
      <p className="font-body text-[11px] tracking-[0.16em] text-champagne/75">
        {kicker}
      </p>
      <p className="font-display mt-1 text-[1.05rem] text-ivory/70">{detail}</p>
    </figcaption>
  );
}

export function GalleryWallCaption({
  caption,
}: {
  caption: GalleryCaptionData;
}) {
  const [kicker, detail] = lightboxCaptionLines(caption);
  return (
    <span className="k9-gallery-caption">
      <span className="k9-gallery-caption-kicker">{kicker}</span>
      <span className="k9-gallery-caption-detail">{detail}</span>
    </span>
  );
}
