import { GalleryWall } from "@/components/gallery/GalleryWall";
import { GALLERY_WALL } from "@/lib/gallery-wall";

export const metadata = {
  title: "Gallery · K9 Atelier",
  description:
    "The K9 Atelier gallery — a private salon-style museum wall of grooming work in Palm Beach.",
};

export default function GalleryPage() {
  return (
    <div
      className="w-full min-h-[calc(100dvh-5.5rem)]"
      style={{ backgroundColor: GALLERY_WALL.background }}
    >
      <h1 className="sr-only">Gallery</h1>
      <GalleryWall />
    </div>
  );
}
