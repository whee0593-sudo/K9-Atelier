import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";

export const servicesIntroductionHeading =
  "Care Designed Around the Individual Dog";
export const servicesIntroductionBody =
  "Every K9 Atelier appointment is private and one-on-one, with services selected around your dog\u2019s coat, skin, comfort and styling needs. From routine bath and coat care to full grooming and traditional hand stripping, each service is approached with careful attention to coat health, balance and finish.";

export function ServicesIntroduction() {
  return (
    <section className="border-t border-gray-line/50 bg-ivory">
      <Container className="py-20 md:py-28">
        <div className="mx-auto max-w-[34rem] text-center md:max-w-[40rem]">
          <h2 className="font-display text-[2rem] leading-[1.15] font-medium tracking-[-0.01em] text-pretty text-ink md:text-[2.5rem] md:leading-[1.12]">
            {servicesIntroductionHeading}
          </h2>
          <p className="font-body mx-auto mt-5 max-w-[36rem] text-base leading-[1.7] text-taupe md:text-[17px] md:leading-[1.75]">
            {servicesIntroductionBody}
          </p>
          <Link
            href="/about"
            className="font-body mt-9 inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          >
            Meet Your Groomer
            <span aria-hidden="true" className="ml-1.5">
              →
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
