import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { business, getCommunitiesServedLabel } from "@/lib/business";
import { photoFor } from "@/lib/gallery";

const heroCtaClass =
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-deep-lavender px-8 text-[13px] font-medium uppercase tracking-[0.14em] text-ivory transition duration-500 hover:bg-ink sm:w-auto md:text-[12px] md:tracking-[0.16em]";

/**
 * The portrait is height-capped and 4:5, so its width is 0.8 × that cap,
 * and also the column. On a 412×823 phone that is about 303px; at 1.75×
 * the size ladder step is 640w.
 */
const HERO_SIZES =
  "(max-width: 767px) min(calc(100vw - 2rem), calc(46vh * 0.8)), (max-width: 1279px) min(calc((min(100vw, 1240px) - 10rem) / 2), calc(80vh * 0.8)), min(calc((min(100vw, 1240px) - 14rem) / 2), calc(80vh * 0.8))";

function HeroServiceMeta({ className = "" }: { className?: string }) {
  return (
    <div
      className={`font-body max-w-xl space-y-3 text-[13px] font-medium uppercase leading-relaxed tracking-[0.12em] text-taupe md:text-[12px] md:tracking-[0.16em] ${className}`}
    >
      <p className="break-words">{getCommunitiesServedLabel()}</p>
      <p className="break-words">
        By Appointment Only · Dogs up to 45 lbs
      </p>
    </div>
  );
}

export function HomeHero() {
  const heroPhoto = photoFor("hero");

  return (
    <section className="relative overflow-hidden border-b border-gray-line/60">
      <Container className="grid items-center gap-8 py-10 md:grid-cols-2 md:gap-16 md:py-20 lg:py-24">
        <div className="md:order-1">
          <Eyebrow>{business.brand.lockup}</Eyebrow>
          <h1 className="font-display mt-5 text-[2.5rem] leading-[1.08] font-medium text-ink md:mt-6 md:text-[3.5rem] lg:text-[4.5rem]">
            {business.brand.tagline}
          </h1>
          <p className="font-body mt-5 max-w-xl text-base leading-relaxed text-taupe md:mt-6 md:text-[17px]">
            {business.brand.lead}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
            <BookServiceLink className={heroCtaClass}>
              Book an Appointment
            </BookServiceLink>
            <Link href="/contact" className={heroCtaClass}>
              Ask a Question
            </Link>
          </div>
          <HeroServiceMeta className="mt-8 hidden md:block" />
        </div>

        <div className="md:order-2">
          {heroPhoto ? (
            <EditorialPhoto
              src={heroPhoto.src}
              alt={heroPhoto.alt}
              priority
              className="shadow-sm"
              imageClassName="max-h-[46vh] md:max-h-[80vh]"
              sizes={HERO_SIZES}
            />
          ) : null}
        </div>

        <HeroServiceMeta className="md:hidden" />
      </Container>
    </section>
  );
}
