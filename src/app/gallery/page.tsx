import { GalleryWall } from "@/components/gallery/GalleryWall";
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
      <h1 className="sr-only">Gallery</h1>
      <GalleryWall />
    </div>
  );
}
