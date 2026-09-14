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
      <header className="mx-auto max-w-3xl px-6 pb-8 pt-10 text-center md:pb-10 md:pt-14">
        <Eyebrow className="text-champagne">The Artistry</Eyebrow>
        <h1 className="font-display mt-4 text-[2.25rem] leading-[1.08] font-medium text-ivory md:text-[2.75rem]">
          A Study in Coat &amp; Form
        </h1>
        <p className="font-body mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[#c8bca9]/80 md:text-base">
          A collection of signature grooms, teaching notes, and show-day
          snapshots — coat, form, and individual expression.
        </p>
      </header>
      <GalleryWall />
    </div>
  );
}
