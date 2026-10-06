import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { business } from "@/lib/business";
import { photoFor } from "@/lib/gallery";
import { LONG_COAT_CARE_PATH } from "@/lib/long-coat-care-page";
import { SPECIALTY_CARE_PATH } from "@/lib/service-page";

const heroCtaClass =
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-deep-lavender px-8 text-[13px] font-medium uppercase tracking-[0.14em] text-ivory transition duration-500 hover:bg-ink sm:w-auto md:text-[12px] md:tracking-[0.16em]";

/**
 * CSS sets the box. `sizes` only picks the file for that box.
 * Desktop is the established 353px portrait. Phones stay on the 46vh cap,
 * about 303px wide at 412×823 and 311px at 390×844.
 */
const HERO_SIZES =
  "(max-width: 767px) min(calc(100vw - 2rem), calc(46vh * 0.8)), (max-width: 1279px) min(353px, calc((min(100vw, 1240px) - 10rem) / 2)), min(353px, calc((min(100vw, 1240px) - 14rem) / 2))";

const HERO_IMAGE_CLASS =
  "aspect-[4/5] !h-auto !w-full max-md:!max-w-[min(calc(100vw-2rem),calc(46vh*0.8))] max-h-[46vh] md:!w-[353px] md:!max-w-[353px] md:max-h-[80vh]";

const HERO_LEAD_LINKS = [
  { phrase: "show-level coat care", href: LONG_COAT_CARE_PATH },
  { phrase: "extra-gentle senior care", href: SPECIALTY_CARE_PATH },
] as const;

const quietInlineLinkClass =
  "underline decoration-champagne/80 underline-offset-[0.2em] transition-colors duration-500 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none";

function HeroLead({ lead }: { lead: string }) {
  const nodes: React.ReactNode[] = [];
  let rest = lead;

  while (rest) {
    const next = HERO_LEAD_LINKS.reduce<
      (typeof HERO_LEAD_LINKS)[number] & { index: number } | null
    >((found, link) => {
      const index = rest.indexOf(link.phrase);
      if (index < 0) return found;
      if (!found || index < found.index) return { ...link, index };
      return found;
    }, null);

    if (!next) {
      nodes.push(rest);
      break;
    }

    if (next.index > 0) nodes.push(rest.slice(0, next.index));
    nodes.push(
      <Link key={next.href} href={next.href} className={quietInlineLinkClass}>
        {next.phrase}
      </Link>,
    );
    rest = rest.slice(next.index + next.phrase.length);
  }

  return <>{nodes}</>;
}

function HeroServiceMeta({ className = "" }: { className?: string }) {
  return (
    <div
      className={`font-body max-w-xl space-y-3 text-[13px] font-medium uppercase leading-relaxed tracking-[0.12em] text-taupe md:text-[12px] md:tracking-[0.16em] ${className}`}
    >
      <p className="text-pretty">
        <span className="whitespace-nowrap">Serving Jupiter Island ·</span>{" "}
        <span className="whitespace-nowrap">Jupiter ·</span>{" "}
        <span className="whitespace-nowrap">Tequesta ·</span>{" "}
        <span className="whitespace-nowrap">Palm Beach Gardens ·</span>{" "}
        <span className="whitespace-nowrap">Palm Beach · West Palm Beach</span>
      </p>
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
            <HeroLead lead={business.brand.lead} />
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
              imageClassName={HERO_IMAGE_CLASS}
              sizes={HERO_SIZES}
            />
          ) : null}
        </div>

        <HeroServiceMeta className="md:hidden" />
      </Container>
    </section>
  );
}
