import { BookServiceLink } from "@/components/booking/BookServiceLink";
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
      title="Groomed by Penny"
      intro="Some photo backgrounds have been edited for presentation."
    >
      <GalleryWall />
      <div className="mt-10 text-center">
        <BookServiceLink className="inline-flex min-h-12 items-center rounded-sm bg-deep-lavender px-8 text-sm font-medium text-ivory hover:bg-ink">Book Online</BookServiceLink>
      </div>
    </PageShell>
  );
}
