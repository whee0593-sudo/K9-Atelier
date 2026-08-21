import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { getCommunitiesServedLabel } from "@/lib/business";
import { photoFor } from "@/lib/gallery";

export function HomeHero() {
  const communities = getCommunitiesServedLabel();
  const heroPhoto = photoFor("hero");

  return (
    <section className="relative overflow-hidden border-b border-gray-line/60">
      <Container className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-20 lg:py-24">
        <div className="order-2 md:order-1">
          <Eyebrow>K9 Atelier · Private Pet Grooming Salon · Palm Beach</Eyebrow>
          <h1 className="font-display mt-6 text-[2.75rem] leading-[1.08] font-medium text-ink md:text-[3.5rem] lg:text-[4.5rem]">
            Precision and devotion —
            <br />
            in every appointment.
          </h1>
          <p className="font-body mt-6 max-w-xl text-base leading-relaxed text-taupe md:text-[17px]">
            Award-winning grooming expertise, brought directly to your door in a
            calm, private, one-on-one salon experience.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[11px] font-medium uppercase tracking-[0.16em] text-ivory transition duration-500 hover:bg-ink">
              Book an Appointment
            </BookServiceLink>
            <LuxuryButton href="/#experience" variant="secondary">
              Discover the Experience
            </LuxuryButton>
          </div>
          <p className="font-body mt-8 max-w-xl text-[12px] font-medium uppercase leading-relaxed tracking-[0.14em] text-taupe sm:tracking-[0.16em]">
            {communities}
            <span className="mt-2 block sm:mt-0 sm:inline">
              <span className="hidden sm:inline"> · </span>
              By Appointment Only · Dogs up to 45 lbs
            </span>
          </p>
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
