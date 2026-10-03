import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { getGallerySlot, type GalleryFrameSlot } from "@/lib/gallery-wall";

/**
 * `sizes` matches the layout width, not the source file.
 * Container padding is px-4, md:px-12, xl:px-20, max 1240px.
 * Mobile feature / closing images span the content width.
 * The middle pair splits that width with a 1rem gap.
 * md+ is four equal columns:
 *   md  px-12 + gap-x-8 × 3  → (100vw - 12rem) / 4
 *   lg  px-12 + gap-x-12 × 3 → (min(100vw, 1240px) - 15rem) / 4
 *   xl  1080px content, gap-x-14 × 3 → 228px
 */
const FEATURE_SIZES =
  "(max-width: 767px) calc(100vw - 2rem), (max-width: 1023px) calc((100vw - 12rem) / 4), (max-width: 1279px) calc((min(100vw, 1240px) - 15rem) / 4), 228px";

const PAIR_SIZES =
  "(max-width: 767px) calc((100vw - 3rem) / 2), (max-width: 1023px) calc((100vw - 12rem) / 4), (max-width: 1279px) calc((min(100vw, 1240px) - 15rem) / 4), 228px";

const HOME_SELECTED_WORK = [
  { id: 4, sizes: FEATURE_SIZES, feature: true },
  { id: 11, sizes: PAIR_SIZES, feature: false },
  { id: 6, sizes: PAIR_SIZES, feature: false },
  { id: 16, sizes: FEATURE_SIZES, feature: true },
] as const;

function selectedSlot(id: number): GalleryFrameSlot {
  const slot = getGallerySlot(id);
  if (!slot) {
    throw new Error(`Missing gallery portrait: ${id}`);
  }
  return slot;
}

export function HomeSelectedWork() {
  const works = HOME_SELECTED_WORK.map((item) => ({
    ...item,
    slot: selectedSlot(item.id),
  }));

  return (
    <section
      aria-labelledby="home-selected-work-heading"
      className="border-b border-gray-line/60 py-16 md:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="home-selected-work-heading"
            className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-ink md:text-xs"
          >
            Selected Work
          </h2>
          <p className="font-body mt-5 text-pretty text-base leading-relaxed text-taupe md:text-[17px]">
            Every coat, considered individually.
          </p>
        </div>

        <ul className="mt-10 grid list-none grid-cols-2 items-center gap-x-4 gap-y-8 p-0 md:mt-14 md:grid-cols-4 md:gap-x-8 md:gap-y-0 lg:gap-x-12 xl:gap-x-14">
          {works.map(({ slot, sizes, feature }) => (
            <li
              key={slot.id}
              className={`min-w-0 ${feature ? "col-span-2 md:col-span-1" : ""}`}
            >
              <Image
                src={slot.photoSrc}
                alt={slot.photoAlt}
                width={slot.photoWidth}
                height={slot.photoHeight}
                sizes={sizes}
                quality={75}
                loading="lazy"
                className="h-auto w-full max-w-full"
              />
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center md:mt-14">
          <Link
            href="/gallery"
            className="group font-body inline-flex min-h-[48px] items-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition duration-500 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne motion-reduce:transition-none"
          >
            View the Gallery
            <span
              aria-hidden="true"
              className="ml-1.5 inline-block transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
