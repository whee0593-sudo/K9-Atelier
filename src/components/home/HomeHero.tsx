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
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-deep-lavender px-8 text-base font-semibold tracking-[0.01em] text-ivory transition duration-500 hover:bg-ink sm:w-auto md:text-sm";

// Match the full-width mobile image and the desktop half-container panel.
const HERO_SIZES = "(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) calc((100vw - 8rem) / 2), 508px";
const HERO_IMAGE_CLASS = "!h-[300px] !w-full !object-contain md:!h-[520px]";

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
      className={`font-body max-w-xl space-y-3 text-sm font-medium leading-relaxed tracking-[0.01em] text-ink md:text-sm ${className}`}
    >
      <p className="text-pretty">
        <span className="whitespace-nowrap">Serving Jupiter Island ·</span>{" "}
        <span className="whitespace-nowrap">Jupiter ·</span>{" "}
        <span className="whitespace-nowrap">Tequesta ·</span>{" "}
        <span className="whitespace-nowrap">Palm Beach Gardens ·</span>{" "}
        <span className="whitespace-nowrap">Palm Beach</span>
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
      <Container className="grid items-center gap-8 py-9 md:grid-cols-2 md:gap-12 md:py-16 lg:py-20">
        <div className="md:order-1">
          <Eyebrow>{business.brand.lockup}</Eyebrow>
          <h1 className="font-display mt-5 text-[2.75rem] leading-[1.02] font-semibold text-ink md:mt-6 md:text-[3.5rem] lg:text-[4.5rem]">
            {business.brand.tagline}
          </h1>
          <p className="font-body mt-5 max-w-xl text-base leading-relaxed text-ink md:mt-6 md:text-[17px]">
            <HeroLead lead={business.brand.lead} />
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
            <BookServiceLink className={heroCtaClass}>
              Book Online
            </BookServiceLink>
            <Link href="/request-a-call" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-sm border-2 border-deep-lavender px-7 text-base font-semibold text-deep-lavender transition-colors hover:bg-dusty-lavender/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-lavender sm:w-auto">
              Request a Call
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
              className="rounded-xl bg-dusty-lavender/50"
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
