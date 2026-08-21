import { Container } from "@/components/luxury/Container";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { photoFor } from "@/lib/gallery";

export function HomeAboutTeaser() {
  const portrait = photoFor("about");

  return (
    <section className="border-b border-gray-line/60 bg-dusty-lavender/20 py-16 md:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        {portrait ? (
          <EditorialPhoto
            src={portrait.src}
            alt={portrait.alt}
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
        ) : null}
        <div>
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
            About Penny
          </p>
          <h2 className="font-display mt-5 text-[2.5rem] leading-[1.1] text-ink md:text-5xl">
            Precision. Patience. Purpose.
          </h2>
          <p className="font-body mt-6 text-base leading-relaxed text-taupe">
            The name &ldquo;Atelier&rdquo; was not chosen by accident. In its truest
            sense, an atelier is a workshop of craftsmanship — where skill is
            refined relentlessly and every detail matters.
          </p>
          <p className="font-body mt-4 text-base leading-relaxed text-taupe">
            From teaching Asian-fusion grooming in Shanghai to Best in Show in
            2019, that same pursuit of artistry defines every appointment today.
          </p>
          <blockquote className="font-display mt-8 border-l border-champagne pl-6 text-2xl leading-snug text-ink italic md:text-3xl">
            &ldquo;Because your dog deserves more than a groomer. They deserve a
            grooming artisan.&rdquo;
          </blockquote>
          <div className="mt-8">
            <LuxuryButton href="/about" variant="secondary">
              Read the Full Story
            </LuxuryButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
