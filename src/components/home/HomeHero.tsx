import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { EditorialPhoto } from "@/components/luxury/EditorialPhoto";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { business } from "@/lib/business";
import { photoFor } from "@/lib/gallery";

const heroCtaClass =
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-deep-lavender px-8 text-base font-semibold tracking-[0.01em] text-ivory transition duration-500 hover:bg-ink sm:w-auto md:text-sm";

// Match the full-width mobile image and the desktop half-container panel.
const HERO_SIZES = "(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) calc((100vw - 8rem) / 2), 508px";
const HERO_IMAGE_CLASS = "!h-[300px] !w-full !object-contain md:!h-[520px]";

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
          <h1 className="font-display text-[clamp(2rem,9vw,2.75rem)] leading-tight font-semibold text-ink md:text-[clamp(2rem,4vw,3.75rem)]">
            {business.brand.wordmark}
          </h1>
          <ul
            role="list"
            className="font-body mt-7 max-w-xl list-disc space-y-1.5 pl-5 text-base font-bold leading-relaxed text-ink marker:text-deep-lavender md:mt-8 md:text-[17px]"
          >
            {business.brand.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
          <div className="mt-9 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
            <BookServiceLink className={heroCtaClass}>
              Book Online
            </BookServiceLink>
            <Link href="/request-a-call" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-sm border-2 border-deep-lavender px-7 text-base font-semibold text-deep-lavender transition-colors hover:bg-dusty-lavender/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-lavender sm:w-auto">
              Request a Call
            </Link>
          </div>
          <HeroServiceMeta className="mt-10 hidden md:block" />
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
