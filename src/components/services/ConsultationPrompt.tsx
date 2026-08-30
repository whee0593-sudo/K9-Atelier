import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";

export function ConsultationPrompt() {
  return (
    <section className="border-y border-gray-line/80 bg-dusty-lavender/20">
      <Container className="py-12 md:py-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <Eyebrow>Complimentary Consultation</Eyebrow>
            <h2 className="font-display mt-4 text-[1.85rem] leading-[1.12] text-ink md:text-4xl">
              Not Sure Which Service Is Right?
            </h2>
            <p className="font-body mt-5 text-sm leading-relaxed text-taupe md:text-base">
              Every dog’s coat, lifestyle, and grooming needs are different. If
              you’re unsure which service would suit your dog best, I would be
              pleased to create a personalized grooming and coat-maintenance
              plan.
            </p>
            <p className="font-body mt-4 text-sm leading-relaxed text-taupe md:text-base">
              Submit clear front-facing, side-profile, and close-up coat photos
              through our Contact page, along with your preferences and the coat
              length you would like to maintain.
            </p>
            <p className="font-body mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-champagne">
              Complimentary · No obligation
            </p>
          </div>
          <Link
            href="/contact?inquiry=grooming-consultation"
            className={`${bookingSecondaryBtnClass} w-full shrink-0 sm:w-auto`}
          >
            Request a Complimentary Consultation
          </Link>
        </div>
      </Container>
    </section>
  );
}