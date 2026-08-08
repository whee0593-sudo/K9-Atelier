import { Container } from "@/components/luxury/Container";
import { PhotoPlaceholder } from "@/components/luxury/PhotoPlaceholder";
import { SectionIntro } from "@/components/luxury/SectionIntro";

export function HomeArtistry() {
  return (
    <section className="border-b border-gray-line/60 bg-dusty-lavender/15 py-16 md:py-24">
      <Container>
        <SectionIntro
          eyebrow="The Finish"
          title="The Artistry"
          body="A restrained gallery of grooming transformations — Poodle, Shih Tzu, Pomeranian, Asian Fusion and Teddy Bear styling."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <PhotoPlaceholder
            aspect="portrait"
            label="Before & after — Poodle styling"
          />
          <PhotoPlaceholder
            aspect="portrait"
            label="Before & after — Shih Tzu finishing"
          />
          <PhotoPlaceholder
            aspect="portrait"
            label="Before & after — Asian Fusion grooming"
          />
        </div>

        <p className="font-body mx-auto mt-8 max-w-2xl text-center text-sm text-taupe">
          Photography will be added as curated before-and-after imagery becomes
          available. Only authentic results will be shown.
        </p>
      </Container>
    </section>
  );
}
