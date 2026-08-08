import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PhotoPlaceholder } from "@/components/luxury/PhotoPlaceholder";
import { BookServiceLink } from "@/components/booking/BookServiceLink";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-line/60">
      <Container className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-20 lg:py-24">
        <div className="order-2 md:order-1">
          <Eyebrow>K9 Atelier · Private Pet Grooming Salon · Palm Beach</Eyebrow>
          <h1 className="font-display mt-6 text-[2.75rem] leading-[1.05] font-medium text-ink md:text-[4rem] lg:text-[5.25rem]">
            Private Grooming,
            <br />
            Beautifully Delivered.
          </h1>
          <p className="font-body mt-6 max-w-xl text-base leading-relaxed text-taupe md:text-[17px]">
            Award-winning grooming expertise, brought directly to your door in a
            calm, private, one-on-one salon experience.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition duration-500 hover:bg-ink">
              Book an Appointment
            </BookServiceLink>
            <LuxuryButton href="/#experience" variant="secondary">
              Discover the Experience
            </LuxuryButton>
          </div>
          <p className="font-body mt-8 text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
            Palm Beach Gardens · By Appointment Only · Dogs up to 45 lbs
          </p>
        </div>

        <div className="order-1 md:order-2">
          <PhotoPlaceholder
            aspect="hero"
            label="Editorial grooming photography — forthcoming"
            className="shadow-sm"
          />
        </div>
      </Container>
    </section>
  );
}
