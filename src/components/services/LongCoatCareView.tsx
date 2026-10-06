import React from "react";
import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { Container } from "@/components/luxury/Container";
import { MobileBookBar } from "@/components/services/MobileBookBar";
import { ServiceCard } from "@/components/services/ServiceCard";
import {
  LONG_COAT_CARE_DISTINCTION,
  LONG_COAT_CARE_GROOMER_AFTER,
  LONG_COAT_CARE_GROOMER_BEFORE,
  LONG_COAT_CARE_GROOMER_NAME,
  LONG_COAT_CARE_MAINTAIN_BODY,
  LONG_COAT_CARE_MAINTAIN_HEADING,
  LONG_COAT_CARE_MALTESE_BODY,
  LONG_COAT_CARE_MALTESE_HEADING,
  LONG_COAT_CARE_PAGE_H1,
  LONG_COAT_CARE_PAGE_INTRO,
  LONG_COAT_CARE_RHYTHM,
  LONG_COAT_CARE_SERVICE_ID,
  LONG_COAT_CARE_YORKIE_BODY,
  LONG_COAT_CARE_YORKIE_HEADING,
} from "@/lib/long-coat-care-page";
import { FULL_GROOM_PATH, SERVICES_PATH, getServiceById } from "@/lib/service-page";

const textLinkClass =
  "font-body inline-flex min-h-[48px] max-w-full items-center justify-center text-center text-[12px] font-medium uppercase leading-snug tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

const inlineLinkClass =
  "text-deep-lavender underline decoration-champagne/70 underline-offset-4 transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

const headingClass =
  "font-display text-balance text-3xl leading-[1.15] text-pretty text-ink md:text-4xl";

const bodyClass = "font-body mt-4 text-sm leading-relaxed text-taupe";

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

function AreaSentence() {
  return (
    <p className="font-body mx-auto max-w-[28rem] text-pretty text-[13px] leading-relaxed text-taupe md:text-sm">
      Serving{" "}
      <span className="whitespace-nowrap">Jupiter Island,</span>{" "}
      <span className="whitespace-nowrap">Jupiter,</span>{" "}
      <span className="whitespace-nowrap">Tequesta,</span>{" "}
      <span className="whitespace-nowrap">Palm Beach Gardens,</span>{" "}
      <span className="whitespace-nowrap">Palm Beach and West Palm Beach.</span>
    </p>
  );
}

export function LongCoatCareView() {
  const service = getServiceById(LONG_COAT_CARE_SERVICE_ID);

  return (
    <div className="pb-24 md:pb-0">
      <section className="bg-white/60 py-14 md:py-16">
        <Container>
          <header className="mx-auto max-w-2xl text-center">
            <h1 className={headingClass}>{LONG_COAT_CARE_PAGE_H1}</h1>
            <p className={bodyClass}>{LONG_COAT_CARE_PAGE_INTRO}</p>
          </header>
        </Container>
      </section>

      <section className="bg-ivory py-14 md:py-16">
        <Container>
          <div className="mx-auto max-w-2xl space-y-14 text-center md:space-y-16">
            <div>
              <h2 className={headingClass}>{LONG_COAT_CARE_MAINTAIN_HEADING}</h2>
              <p className={bodyClass}>{LONG_COAT_CARE_MAINTAIN_BODY}</p>
              <p className={bodyClass}>{LONG_COAT_CARE_DISTINCTION}</p>
              <p className={bodyClass}>{LONG_COAT_CARE_RHYTHM}</p>
              <p className={bodyClass}>
                When the goal is a haircut or a styled finish,{" "}
                <Link href={FULL_GROOM_PATH} className={inlineLinkClass}>
                  Full Grooming
                </Link>{" "}
                is a separate appointment.
              </p>
              <p className={bodyClass}>
                {LONG_COAT_CARE_GROOMER_BEFORE}
                <Link href="/about" className={inlineLinkClass}>
                  {LONG_COAT_CARE_GROOMER_NAME}
                </Link>
                {LONG_COAT_CARE_GROOMER_AFTER}
              </p>
            </div>

            <div>
              <h2 className={headingClass}>{LONG_COAT_CARE_MALTESE_HEADING}</h2>
              {LONG_COAT_CARE_MALTESE_BODY.map((paragraph) => (
                <p key={paragraph} className={bodyClass}>
                  {paragraph}
                </p>
              ))}
            </div>

            <div>
              <h2 className={headingClass}>{LONG_COAT_CARE_YORKIE_HEADING}</h2>
              {LONG_COAT_CARE_YORKIE_BODY.map((paragraph) => (
                <p key={paragraph} className={bodyClass}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {service ? (
        <section className="bg-white/60 py-14 md:py-16" aria-labelledby="show-care-booking">
          <Container>
            <div className="mx-auto max-w-2xl">
              <ServiceCard
                service={service}
                headingAs="h2"
                anchorId="show-care-booking"
                detailsInitiallyOpen
              />
            </div>
          </Container>
        </section>
      ) : null}

      <section className="bg-ivory py-14 md:py-16">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <AreaSentence />
            <div className="mt-8 flex flex-col items-center">
              <TextLink href={SERVICES_PATH}>Explore All Services</TextLink>
              <TextLink href={FULL_GROOM_PATH}>Full Grooming</TextLink>
              <TextLink href="/about">Meet Your Groomer</TextLink>
              <BookServiceLink className={textLinkClass}>
                Book an Appointment
                <span aria-hidden="true" className="ml-1.5">
                  →
                </span>
              </BookServiceLink>
            </div>
          </div>
        </Container>
      </section>
      <MobileBookBar />
    </div>
  );
}
