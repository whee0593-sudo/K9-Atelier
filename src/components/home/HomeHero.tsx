import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { business } from "@/lib/business";
import { photoFor } from "@/lib/gallery";

export function HomeHero() {
  const heroPhoto = photoFor("hero");

  return (
    <section className="relative overflow-hidden border-b border-gray-line/60">
      <Container className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-20 lg:py-24">
        <div className="order-2 md:order-1">
          <Eyebrow>{business.brand.lockup}</Eyebrow>
          <h1 className="font-display mt-6 text-[2.75rem] leading-[1.08] font-medium text-ink md:text-[3.5rem] lg:text-[4.5rem]">
            {business.brand.tagline}
          </h1>
          <p className="font-body mt-6 max-w-xl text-base leading-relaxed text-taupe md:text-[17px]">
            Award-winning grooming, brought directly to your door for a calm,
            private, one-on-one appointment.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[11px] font-medium uppercase tracking-[0.16em] text-ivory transition duration-500 hover:bg-ink">
              Book an Appointment
            </BookServiceLink>
            <LuxuryButton href="/#experience" variant="secondary">
              Discover the Experience
            </LuxuryButton>
          </div>
          <div className="font-body mt-8 max-w-xl space-y-3 text-[11px] font-medium uppercase leading-relaxed tracking-[0.12em] text-taupe sm:text-[12px] sm:tracking-[0.16em]">
            <p className="break-words">
              West Palm Beach · Palm Beach Gardens · Jupiter
            </p>
            <p className="break-words">
              By Appointment Only · Dogs up to 45 lbs
            </p>
          </div>
        </div>

        <div className="order-1 md:order-2">
          {heroPhoto ? (
            <EditorialPhoto
              src={heroPhoto.src}
              alt={heroPhoto.alt}
              priority
              className="shadow-sm"
              sizes="(min-width: 768px) 42vw, 100vw"
            />
          ) : null}
        </div>
      </Container>
    </section>
  );
}
