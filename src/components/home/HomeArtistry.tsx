import { Container } from "@/components/luxury/Container";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { SectionIntro } from "@/components/luxury/SectionIntro";
import { photosFor } from "@/lib/gallery";

export function HomeArtistry() {
  const photos = photosFor("artistry").slice(0, 3);

  return (
    <section
      id="gallery"
      className="scroll-mt-24 border-b border-gray-line/60 bg-dusty-lavender/15 py-16 md:py-24"
    >
      <Container>
        <SectionIntro
          eyebrow="The Finish"
          title="The Artistry"
          body="A restrained gallery of grooming transformations — teddy bear styling, breed-standard finishing, and creative color."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <EditorialPhoto
                src={photo.src}
                alt={photo.alt}
                aspect="portrait"
                sizes="(min-width: 768px) 30vw, 100vw"
              />
              <figcaption className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-12 text-center">
          <LuxuryButton href="/gallery" variant="secondary">
            View the Gallery
          </LuxuryButton>
        </div>
      </Container>
    </section>
  );
}
