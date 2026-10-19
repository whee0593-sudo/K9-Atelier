import React from "react";
import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { Container } from "@/components/luxury/Container";

const introLinkClass =
  "font-body inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

export const servicesIntroductionHeading =
  "Grooming with Penny";
export const servicesIntroductionBody =
  "An award-winning groomer with experience in breed styling, hand stripping and coat care.";

export function ServicesIntroduction() {
  return (
    <section className="border-t border-gray-line/50 bg-ivory">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-[34rem] text-center md:max-w-[40rem]">
          <h2 className="font-display text-[2rem] leading-[1.15] font-medium tracking-[-0.01em] text-pretty text-ink md:text-[2.5rem] md:leading-[1.12]">
            {servicesIntroductionHeading}
          </h2>
          <p className="font-body mx-auto mt-5 max-w-[36rem] text-base leading-[1.7] text-taupe md:text-[17px] md:leading-[1.75]">
            {servicesIntroductionBody}
          </p>
          <div className="mt-9 flex flex-col items-center">
            <BookServiceLink className={introLinkClass}>
              Book Online
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </BookServiceLink>
            <Link href="/about" className={introLinkClass}>
              Meet Your Groomer
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
