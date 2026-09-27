import { GalleryWall } from "@/components/gallery/GalleryWall";
import { PageShell } from "@/components/luxury/PageShell";

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
    <PageShell
      eyebrow="The Work"
      title="Gallery"
      intro="Selected work by K9 Atelier"
    >
      <GalleryWall />
    </PageShell>
  );
}
