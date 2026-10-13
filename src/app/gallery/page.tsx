import { GalleryWall } from "@/components/gallery/GalleryWall";
import { PageShell } from "@/components/luxury/PageShell";

export const metadata = {
  title: "Our Work | K9 Atelier Mobile Pet Spa",
  description:
    "Explore the K9 Atelier grooming gallery featuring signature pet styling, show-inspired finishes, creative grooming, and tailored coat work in Palm Beach County.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function GalleryPage() {
  return (
    <PageShell
      eyebrow="K9 ATELIER · OUR WORK"
      title="The Art of Grooming"
      intro="A collection of our grooming work, reflecting thoughtful detail, refined styling, and individualized coat care."
    >
      <GalleryWall />
    </PageShell>
  );
}
