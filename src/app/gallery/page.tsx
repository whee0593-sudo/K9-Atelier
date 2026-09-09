import { GalleryWall } from "@/components/gallery/GalleryWall";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { GALLERY_WALL } from "@/lib/gallery-wall";

export const metadata = {
  title: "Gallery · K9 Atelier",
  description:
    "Explore the K9 Atelier grooming gallery featuring signature pet styling, show-inspired finishes, creative grooming, and tailored coat work in Palm Beach County.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function GalleryPage() {
  return (
    <div
      className="w-full overflow-x-clip pb-12 md:pb-16"
      style={{ backgroundColor: GALLERY_WALL.background }}
    >
      <header className="mx-auto max-w-3xl px-6 pb-10 pt-14 text-center md:pb-14 md:pt-20">
        <Eyebrow className="text-champagne">The Artistry</Eyebrow>
        <h1 className="font-display mt-5 text-[2.5rem] leading-[1.08] font-medium text-ivory md:text-5xl">
          A Study in Coat &amp; Form
        </h1>
        <p className="font-body mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#c8bca9]/80 md:text-[17px]">
          A collection of signature grooms, show-inspired finishes, and
          individual expressions — each shaped around the dog in front of me.
        </p>
      </header>
      <GalleryWall />
    </div>
  );
}
