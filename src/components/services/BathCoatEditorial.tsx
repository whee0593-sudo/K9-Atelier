import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  BATH_COAT_FAQS,
  BATH_COAT_FULL_GROOM_NOTE,
  BATH_COAT_HAND_STRIPPING_NOTE,
  BATH_COAT_MORE_BODY,
  BATH_COAT_MORE_HEADING,
  BATH_COAT_ROUTINE_BODY,
  BATH_COAT_ROUTINE_HEADING,
  FULL_GROOM_PATH,
  HAND_STRIPPING_PATH,
  SERVICES_PATH,
} from "@/lib/service-page";

const textLinkClass =
  "font-body inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

const sections = [
  {
    heading: BATH_COAT_MORE_HEADING,
    body: BATH_COAT_MORE_BODY,
  },
  {
    heading: BATH_COAT_ROUTINE_HEADING,
    body: BATH_COAT_ROUTINE_BODY,
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

export function BathCoatEditorial() {
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
                <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                  {section.body}
                </p>
              </div>
            ))}

            <div>
              <p className="font-body text-sm leading-relaxed text-taupe">
                {BATH_COAT_FULL_GROOM_NOTE}
              </p>
              <p className="mt-6">
                <TextLink href={FULL_GROOM_PATH}>Full Grooming</TextLink>
              </p>
              <p className="font-body mt-8 text-sm leading-relaxed text-taupe">
                {BATH_COAT_HAND_STRIPPING_NOTE}
              </p>
              <p className="mt-6">
                <TextLink href={HAND_STRIPPING_PATH}>Hand Stripping</TextLink>
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-white/60 py-14 md:py-16" aria-labelledby="bath-coat-questions">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="bath-coat-questions"
              className="font-display text-center text-3xl text-ink md:text-4xl"
            >
              Questions
            </h2>
            <div className="mt-8 divide-y divide-gray-line/80 border-y border-gray-line/80">
              {BATH_COAT_FAQS.map((faq) => (
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
              <TextLink href="/about">Meet Your Groomer</TextLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
