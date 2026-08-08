import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";

export function HomeGentleCare() {
  return (
    <section className="border-b border-gray-line/60 py-16 md:py-24">
      <Container className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <SectionIntro
          align="left"
          eyebrow="Gentle Care"
          title={
            <>
              For Dogs Who Need
              <br />a Little More Time.
            </>
          }
          body={
            <>
              <p>
                Some dogs need more than a standard grooming appointment.
              </p>
              <p className="mt-4">
                K9 Atelier offers patient, adapted care for senior dogs, dogs
                with limited mobility, post-surgical recovery and serious health
                conditions — always prioritizing comfort, dignity and trust.
              </p>
            </>
          }
        />

        <div className="border border-gray-line/80 bg-ivory p-8 md:p-10">
          <h3 className="font-display text-2xl text-ink">
            Senior & Gentle Comfort Care
          </h3>
          <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
            Additional pricing from +$30 depending on weight. Suitable for
            senior dogs who require extra resting breaks, adapted handling,
            anti-slip support, gentler drying and a slower grooming pace.
          </p>
          <div className="mt-8 border-t border-gray-line/80 pt-8">
            <h4 className="font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-deep-lavender">
              End-of-Life Comfort Care
            </h4>
            <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
              Compassionate, low-stress grooming support for dogs in their final
              stage of life. Complimentary, by appointment only. Dogs over 45 lbs
              may receive this service even when standard bath/full grooming
              services are unavailable.
            </p>
          </div>
          <Link
            href="/services#gentle-care"
            className="font-body mt-8 inline-flex min-h-[48px] items-center text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink"
          >
            View Gentle Care Details
          </Link>
        </div>
      </Container>
    </section>
  );
}
