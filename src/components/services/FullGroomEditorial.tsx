import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  BATH_COAT_PATH,
  FULL_GROOM_AREA_SENTENCE,
  FULL_GROOM_FAQS,
  FULL_GROOM_GROOMER_AFTER,
  FULL_GROOM_GROOMER_BEFORE,
  FULL_GROOM_GROOMER_NAME,
  FULL_GROOM_INCLUDED_BODY,
  FULL_GROOM_INCLUDED_HEADING,
  FULL_GROOM_STYLING_BODY,
  FULL_GROOM_STYLING_HEADING,
  SERVICES_PATH,
} from "@/lib/service-page";

const textLinkClass =
  "font-body inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

const inlineLinkClass =
  "text-deep-lavender underline decoration-champagne/70 underline-offset-4 transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

function TextLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className={textLinkClass}>
      {children}
      <span aria-hidden="true" className="ml-1.5">
        →
      </span>
    </Link>
  );
}

export function FullGroomEditorial() {
  return (
    <>
      <section className="bg-ivory py-14 md:py-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl text-ink md:text-4xl">
              {FULL_GROOM_INCLUDED_HEADING}
            </h2>
            <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
              {FULL_GROOM_INCLUDED_BODY}
            </p>
            <p className="mt-6">
              <TextLink href={BATH_COAT_PATH}>Bath & Coat Care</TextLink>
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-2xl text-center md:mt-16">
            <h2 className="font-display text-3xl text-ink md:text-4xl">
              {FULL_GROOM_STYLING_HEADING}
            </h2>
            <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
              {FULL_GROOM_STYLING_BODY}
            </p>
            <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
              {FULL_GROOM_GROOMER_BEFORE}
              <Link href="/about" className={inlineLinkClass}>
                {FULL_GROOM_GROOMER_NAME}
              </Link>
              {FULL_GROOM_GROOMER_AFTER}
            </p>
            <p className="mt-6">
              <TextLink href="/about">Meet Your Groomer</TextLink>
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-white/60 py-14 md:py-16" aria-labelledby="full-groom-questions">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="full-groom-questions"
              className="font-display text-center text-3xl text-ink md:text-4xl"
            >
              Questions
            </h2>
            <div className="mt-8 divide-y divide-gray-line/80 border-y border-gray-line/80">
              {FULL_GROOM_FAQS.map((faq) => (
                <details key={faq.question} open className="group py-6">
                  <summary className="cursor-pointer list-none font-body text-base font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-4 text-left">
                      {faq.question}
                      <span className="text-champagne transition group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
            <p className="font-body mx-auto mt-10 max-w-2xl text-center text-pretty text-sm leading-relaxed text-taupe">
              {FULL_GROOM_AREA_SENTENCE}
            </p>
            <p className="mt-6 text-center">
              <TextLink href={SERVICES_PATH}>Explore All Services</TextLink>
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
