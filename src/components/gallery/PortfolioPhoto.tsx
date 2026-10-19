import React from "react";
import Image from "next/image";

// Show only the photograph inside the existing frame. The original assets and
// the framed Our Work gallery remain untouched; no dog pixels are regenerated.
const photos = {
  4: { width: 1119, height: 1405, left: 225, top: 235, cropWidth: 670, cropHeight: 920, oval: false, alt: "Chocolate-and-white poodle with a floral ribbon, groomed by Penny" },
  11: { width: 1116, height: 1409, left: 225, top: 255, cropWidth: 665, cropHeight: 890, oval: true, alt: "Pomeranian in a Boo cut, groomed by Penny" },
  6: { width: 1141, height: 1378, left: 235, top: 315, cropWidth: 670, cropHeight: 790, oval: true, alt: "Yorkshire Terrier with a Princess look, groomed by Penny" },
  16: { width: 1364, height: 1153, left: 185, top: 180, cropWidth: 990, cropHeight: 785, oval: false, alt: "Norwich Terrier with a hand-stripped coat, groomed by Penny" },
} as const;

export function PortfolioPhoto({ id, sizes, loading = "lazy" }: {
  id: keyof typeof photos;
  sizes: string;
  loading?: "eager" | "lazy";
}) {
  const p = photos[id];
  return <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${p.cropWidth} / ${p.cropHeight}`, borderRadius: p.oval ? "50%" : undefined }}>
    <Image src={`/images/gallery/wall/gallery-${String(id).padStart(2, "0")}.png`} alt={p.alt}
      width={p.width} height={p.height} sizes={sizes} loading={loading} quality={75}
      className="absolute h-auto !max-w-none"
      style={{ width: `${p.width / p.cropWidth * 100}%`, left: `${-p.left / p.cropWidth * 100}%`, top: `${-p.top / p.cropHeight * 100}%` }} />
  </div>;
}


