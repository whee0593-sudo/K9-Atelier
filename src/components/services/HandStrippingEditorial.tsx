import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  BATH_COAT_PATH,
  HAND_STRIPPING_COMPARE_BODY,
  HAND_STRIPPING_COMPARE_HEADING,
  HAND_STRIPPING_FAQS,
  HAND_STRIPPING_GROOMER_AFTER,
  HAND_STRIPPING_GROOMER_BEFORE,
  HAND_STRIPPING_GROOMER_NAME,
  HAND_STRIPPING_MAINTENANCE_BODY,
  HAND_STRIPPING_MAINTENANCE_HEADING,
  HAND_STRIPPING_SUITABLE_BODY,
  HAND_STRIPPING_SUITABLE_HEADING,
  HAND_STRIPPING_SUITABLE_NOTE,
  HAND_STRIPPING_WHAT_BODY,
  HAND_STRIPPING_WHAT_HEADING,
  SERVICES_PATH,
} from "@/lib/service-page";

const textLinkClass =
  "font-body inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

const inlineLinkClass =
  "text-deep-lavender underline decoration-champagne/70 underline-offset-4 transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

const sections = [
  {
    heading: HAND_STRIPPING_WHAT_HEADING,
    paragraphs: [HAND_STRIPPING_WHAT_BODY],
  },
  {
    heading: HAND_STRIPPING_COMPARE_HEADING,
    paragraphs: [HAND_STRIPPING_COMPARE_BODY],
  },
  {
    heading: HAND_STRIPPING_SUITABLE_HEADING,
    paragraphs: [HAND_STRIPPING_SUITABLE_BODY, HAND_STRIPPING_SUITABLE_NOTE],
  },
  {
    heading: HAND_STRIPPING_MAINTENANCE_HEADING,
    paragraphs: [HAND_STRIPPING_MAINTENANCE_BODY],
  },
] as const;

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

export function HandStrippingEditorial() {
  return (
    <>
      <section className="bg-ivory py-14 md:py-16">
        <Container>
          <div className="mx-auto max-w-2xl space-y-14 text-center md:space-y-16">
            {sections.map((section) => (
              <div key={section.heading}>
                <h2 className="font-display text-3xl leading-[1.15] text-pretty text-ink md:text-4xl">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="font-body mt-4 text-sm leading-relaxed text-taupe"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.heading === HAND_STRIPPING_WHAT_HEADING ? (
                  <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                    {HAND_STRIPPING_GROOMER_BEFORE}
                    <Link href="/about" className={inlineLinkClass}>
                      {HAND_STRIPPING_GROOMER_NAME}
                    </Link>
                    {HAND_STRIPPING_GROOMER_AFTER}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section
        className="bg-white/60 py-14 md:py-16"
        aria-labelledby="hand-stripping-questions"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="hand-stripping-questions"
              className="font-display text-center text-3xl text-ink md:text-4xl"
            >
              Questions
            </h2>
            <div className="mt-8 divide-y divide-gray-line/80 border-y border-gray-line/80">
              {HAND_STRIPPING_FAQS.map((faq) => (
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
            <div className="mt-10 flex flex-col items-center">
              <TextLink href={SERVICES_PATH}>Explore All Services</TextLink>
              <TextLink href={BATH_COAT_PATH}>Bath & Coat Care</TextLink>
              <TextLink href="/about">Meet Your Groomer</TextLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
