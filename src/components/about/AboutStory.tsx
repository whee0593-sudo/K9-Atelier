import React from "react";
import Image from "next/image";
import Link from "next/link";
import { AboutDeferredPhoto } from "@/components/about/AboutDeferredPhoto";
import { Container } from "@/components/luxury/Container";

const awards = [
  { year: "2014", title: "Best in Group", breed: "Pomeranian" },
  { year: "2017", title: "Best in Group", breed: "Poodle" },
  { year: "2019", title: "Best in Show", breed: "Bichon" },
] as const;

const photos = {
  portrait: {
    src: "/images/about/about-professional-portrait.jpg",
    alt: "Penny in a black suit beside a white dog, a formal studio portrait",
    width: 418,
    height: 406,
  },
  group: {
    src: "/images/about/about-competition-group.jpg",
    alt: "Groomers and their dogs gathered on a professional grooming competition floor",
    width: 700,
    height: 433,
  },
  grooming: {
    src: "/images/about/about-competition-grooming.jpg",
    alt: "Penny grooming during a professional grooming competition",
    width: 2400,
    height: 1600,
  },
  trophy: {
    src: "/images/about/about-2019-trophy.jpg",
    alt: "Penny receiving an award at a professional grooming competition",
    width: 960,
    height: 640,
  },
  award: {
    src: "/images/about/about-2019-award.jpg",
    alt: "Penny with a white Bichon, a trophy, and award rosettes after Best in Show in 2019",
    width: 960,
    height: 801,
  },
  credentials: {
    src: "/images/about/about-awards-credentials.jpg",
    alt: "Professional grooming awards, rosettes and certificates",
    width: 960,
    height: 720,
  },
  teaching: {
    src: "/images/about/about-teaching.jpg",
    alt: "Penny demonstrating grooming technique during hands-on instruction",
    width: 1016,
    height: 1080,
  },
  craft: {
    src: "/images/about/about-craft-detail.jpg",
    alt: "A groomer finishing a detailed facial trim on a brown poodle",
    width: 1600,
    height: 2400,
  },
  approach: {
    src: "/images/about/about-approach-portrait.jpg",
    alt: "A cream curly-coated dog sitting in a finished groom",
    width: 1122,
    height: 1402,
  },
} as const;

const headingClass =
  "font-display mt-5 text-balance text-[clamp(2.15rem,4.2vw+1rem,3.7rem)] leading-[1.08] font-medium tracking-[-0.02em] text-ink";

const proseClass =
  "font-body max-w-[40rem] space-y-6 text-[16px] leading-[1.8] text-ink md:text-[18px] md:leading-[1.85]";

const captionClass =
  "font-body mt-3 text-sm font-medium uppercase tracking-[0.18em] text-ink md:mt-4";

const textLinkClass =
  "font-body mt-8 inline-flex max-w-full min-h-[48px] items-center justify-center text-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne md:mt-10";

/**
 * Show-ring column, not the viewport.
 * Mobile is the padded container. From 768px the grid is two columns.
 * At 1280px the container caps at 1240px, so each photo is 512px wide.
 */
const SHOW_RING_SIZES =
  "(min-width: 1280px) 512px, (min-width: 1024px) calc((100vw - 9.5rem) / 2), (min-width: 768px) calc((100vw - 8.5rem) / 2), calc(100vw - 2rem)";

/**
 * The group photo is only 700px / ~100KB. A 750w derivative is larger than
 * that file. Cap the mobile slot at 365px so a 1.75x screen selects 640w,
 * the closest candidate that stays smaller than the source.
 */
const GROUP_PHOTO_SIZES =
  "(min-width: 1280px) 512px, (min-width: 1024px) calc((100vw - 9.5rem) / 2), (min-width: 768px) calc((100vw - 8.5rem) / 2), min(365px, calc(100vw - 2rem))";

function AboutPhoto({
  src,
  alt,
  width,
  height,
  sizes,
  className = "h-auto w-full",
  priority = false,
  defer = false,
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  priority?: boolean;
  defer?: boolean;
  objectPosition?: string;
}) {
  if (defer) {
    const frameClassName = className
      .split(/\s+/)
      .filter((token) => token && token !== "object-cover")
      .join(" ");
    return (
      <AboutDeferredPhoto
        src={src}
        alt={alt}
        sizes={sizes}
        frameClassName={frameClassName}
        objectPosition={objectPosition}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      quality={90}
      className={className}
      style={{ objectPosition }}
    />
  );
}

function AwardsTimeline() {
  return (
    <div className="mt-16 md:mt-24 lg:mt-28">
      <ol className="md:hidden">
        {awards.map((award, index) => (
          <li key={award.year} className="relative pb-14 pl-10 last:pb-0">
            {index < awards.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-3 bottom-0 left-[3px] w-px bg-champagne/55"
              />
            ) : null}
            <span
              aria-hidden
              className="absolute top-3 left-0 h-[7px] w-[7px] rounded-full bg-champagne"
            />
            <p className="font-display text-[3.35rem] leading-none text-ink min-[390px]:text-[3.6rem]">
              {award.year}
            </p>
            <p className="font-body mt-4 text-[12px] font-medium uppercase tracking-[0.16em] text-ink">
              {award.title}
            </p>
            <p className="font-display mt-2 text-[1.65rem] text-ink italic">
              {award.breed}
            </p>
          </li>
        ))}
      </ol>

      <ol className="relative hidden md:grid md:grid-cols-3">
        <div
          aria-hidden
          className="pointer-events-none absolute top-[calc(4.5rem+2rem+3.5px)] right-[16.67%] left-[16.67%] h-px bg-champagne/75 lg:top-[calc(5.4rem+2.5rem+3.5px)]"
        />
        {awards.map((award) => (
          <li key={award.year} className="relative text-center">
            <p className="font-display text-[4.5rem] leading-none text-ink lg:text-[5.4rem]">
              {award.year}
            </p>
            <div className="my-8 flex justify-center lg:my-10" aria-hidden>
              <span className="relative z-10 h-[7px] w-[7px] rounded-full bg-champagne ring-[6px] ring-ivory" />
            </div>
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-ink lg:text-[13px] lg:tracking-[0.18em]">
              {award.title}
            </p>
            <p className="font-display mt-3 text-[1.7rem] text-ink italic lg:text-[2rem]">
              {award.breed}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AboutStory() {
  return (
    <div className="overflow-x-clip">
      <Container>
        <article className="py-12 md:py-20">
          <section aria-labelledby="about-penny" className="grid items-start gap-8 lg:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] lg:gap-16">
            <header className="lg:col-start-2 lg:row-start-1">
              <h1 id="about-penny" className={headingClass}>Meet Penny</h1>
              <p className="font-display mt-5 text-2xl text-ink italic">Founder & Groomer, K9 Atelier</p>
              <div className={`${proseClass} mt-6`}>
                <p>Hi, I’m Penny. I’ve been grooming professionally since 2010, and my favorite part is getting to know the little personality behind every face.</p>
                <p>K9 Atelier Mobile Pet Spa welcomes private clients for personal, one-on-one care. Your pup sees the same familiar groomer each time, helping us build trust and a comfortable routine together.</p>
                <p>With a background in award-winning show grooming, I bring a practiced eye and a gentle touch to every visit. I’m proud to serve our local communities and care for the dogs and families who call them home, visit after visit.</p>
              </div>
              <Link href="/services" className={textLinkClass}>Explore Our Services →</Link>
            </header>
            <figure className="mx-auto w-full max-w-[22rem] lg:col-start-1 lg:row-start-1">
              <AboutPhoto {...photos.portrait} sizes="(min-width: 1024px) 352px, min(352px, calc(100vw - 2rem))" priority />
            </figure>
          </section>

          <section className="mt-16 md:mt-20" aria-labelledby="about-awards">
            <h2 id="about-awards" className="font-display text-3xl text-ink md:text-4xl">From the Show Ring</h2>
            <p className={`${proseClass} mt-4`}>Competition shaped my approach to coat preparation, balance and finishing.</p>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <figure>
                <AboutPhoto {...photos.grooming} sizes={SHOW_RING_SIZES} defer objectPosition="62% center" className="aspect-[3/2] w-full object-cover" />
              </figure>
              <figure>
                <AboutPhoto {...photos.award} sizes={SHOW_RING_SIZES} defer className="aspect-[960/801] w-full object-cover" />
                <figcaption className={captionClass}>2019 · Best in Show · Bichon</figcaption>
              </figure>
            </div>
            <AwardsTimeline />
            <details className="mt-8 border-y border-gray-line py-4">
              <summary className="font-body flex min-h-12 cursor-pointer items-center text-base font-medium text-deep-lavender">More from the competition archive</summary>
              <div className="mt-6 grid gap-8 md:grid-cols-3">
                <AboutPhoto {...photos.trophy} sizes="(min-width: 768px) 30vw, calc(100vw - 2rem)" className="h-auto w-full" />
                <AboutPhoto {...photos.group} sizes={GROUP_PHOTO_SIZES} className="h-auto w-full" />
                <AboutPhoto {...photos.credentials} sizes="(min-width: 768px) 30vw, calc(100vw - 2rem)" className="h-auto w-full" />
              </div>
            </details>
          </section>

          <section className="mt-16 md:mt-20" aria-labelledby="about-teaching">
            <div className="grid items-center gap-8 md:grid-cols-2 lg:gap-16">
              <figure className="mx-auto w-full max-w-sm">
                <AboutPhoto {...photos.teaching} sizes="(min-width: 768px) 384px, calc(100vw - 2rem)" className="h-auto w-full" />
              </figure>
              <div>
                <h2 id="about-teaching" className="font-display text-3xl text-ink md:text-4xl">Sharing the Craft</h2>
                <p className={`${proseClass} mt-4`}>I also teach hands-on grooming techniques, with a focus on coat health and comfortable handling.</p>
                <Link href="/book" className="font-body mt-6 inline-flex min-h-12 items-center justify-center rounded-sm bg-deep-lavender px-8 text-sm font-medium text-ivory hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-lavender">Book Online</Link>
              </div>
            </div>
            <details className="mt-8 border-y border-gray-line py-4">
              <summary className="font-body flex min-h-12 cursor-pointer items-center text-base font-medium text-deep-lavender">More grooming photographs</summary>
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                <AboutPhoto {...photos.craft} sizes="(min-width: 768px) 40vw, calc(100vw - 2rem)" className="mx-auto h-auto w-full max-w-sm" />
                <AboutPhoto {...photos.approach} sizes="(min-width: 768px) 40vw, calc(100vw - 2rem)" className="mx-auto h-auto w-full max-w-sm" />
              </div>
            </details>
          </section>
        </article>
      </Container>
    </div>
  );
}
