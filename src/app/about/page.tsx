import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";

export const metadata = {
  title: "About K9 Atelier",
  description:
    "The story behind K9 Atelier — a cage-free, mobile grooming studio serving Palm Beach County, built on precision, patience, and purpose.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">
          Precision. Patience. Purpose.
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-gold-dark">
          About K9 Atelier
        </h1>
      </header>

      <div className="mt-12 space-y-6 text-base leading-relaxed text-text">
        <p>
          The name &ldquo;Atelier&rdquo; was not chosen by accident. In its
          truest sense, an atelier is a workshop of craftsmanship &mdash; a
          place where skill is honed relentlessly, where every detail matters,
          and where good enough is never quite enough. That philosophy sits at
          the heart of everything I do.
        </p>
        <p>
          I believe this industry calls for more than a gentle heart and loving
          hands, though both are essential. It calls for genuine mastery &mdash;
          the same discipline, precision, and pursuit of excellence you&apos;d
          expect from any true craft.
        </p>
        <p>
          My journey began in 2010. What started as a passion quickly became a
          calling, and through relentless dedication &mdash; and perhaps a touch
          of natural talent &mdash; I progressed quickly. By 2014, I was teaching
          Asian-fusion style grooming and Show grooming at a professional
          grooming academy in Shanghai, China, mentoring students and leading
          them into the competition ring, where many went on to earn top honors
          of their own.
        </p>
        <p>
          During those years, I competed extensively myself &mdash; earning
          individual awards for my work on Pomeranians, Poodles, and Shih Tzus.
          Then in 2019, I reached the highest honor of my career: Best in Show
          at a national grooming competition, the culmination of nearly a decade
          of discipline and craft.
        </p>
        <p>
          In 2020, I left everything familiar behind and came to the United
          States with my son &mdash; not yet a year old &mdash; two suitcases,
          and $2,000 to my name. It was the beginning of a new chapter, built on
          the same values that had carried me this far: precision, patience, and
          an unwavering respect for every dog that sits in my care.
        </p>
        <p>
          Today, K9 Atelier is the culmination of that journey &mdash; a
          cage-free, mobile grooming studio serving Palm Beach County, built for
          dog owners who want nothing less than genuine expertise paired with
          genuine care. Every appointment reflects the same standard I&apos;ve
          held myself to since day one: technical mastery in service of comfort,
          dignity, and trust.
        </p>
      </div>

      <blockquote className="mt-14 rounded-2xl border border-lavender/40 bg-lavender-light/30 px-8 py-10 text-center">
        <p className="text-xl font-medium leading-relaxed text-gold-dark md:text-2xl">
          Because your dog deserves more than a groomer.
          <br className="hidden sm:block" /> They deserve a grooming artisan.
        </p>
      </blockquote>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href="/services"
          className="inline-block rounded-full border border-gold px-8 py-3 text-sm font-medium text-gold-dark transition hover:bg-gold hover:text-white"
        >
          View Services
        </Link>
        <BookServiceLink className="inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark">
          Book Now
        </BookServiceLink>
      </div>
    </div>
  );
}
