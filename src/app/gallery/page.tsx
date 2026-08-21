import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { PageShell } from "@/components/luxury/PageShell";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { photosFor } from "@/lib/gallery";

export const metadata = {
  title: "Gallery · K9 Atelier",
  description:
    "Grooming photography from K9 Atelier — teddy bear styling, breed-standard finishing, and creative color in Palm Beach.",
};

export default function GalleryPage() {
  const photos = photosFor("gallery");

  return (
    <PageShell
      eyebrow="The Finish"
      title={
        <>
          Grooming,
          <br />
          Photographed.
        </>
      }
      intro="A quiet selection of finished work — precision cuts, breed-standard styling, and creative color."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <figure key={photo.id}>
            <EditorialPhoto
              src={photo.src}
              alt={photo.alt}
              sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 100vw"
            />
            <figcaption className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <LuxuryButton href="/services" variant="secondary">
          Explore Services
        </LuxuryButton>
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Book an Appointment
        </BookServiceLink>
      </div>
    </PageShell>
  );
}
