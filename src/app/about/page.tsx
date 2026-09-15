import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";

export const metadata = {
  title: "About · K9 Atelier",
  description:
    "Penny, the groomer behind K9 Atelier — professional care since 2010, show honors including Best in Show, and a private mobile pet spa in Palm Beach.",
};

const highlights = [
  "Professional grooming since 2010, with a calm, one-on-one standard of care.",
  "Former head groomer at a premier luxury dog salon in Shanghai.",
  "Five years teaching Asian fusion and show styling at a professional academy.",
] as const;

const honors = [
  { year: "2014", title: "Best in Group", detail: "Pomeranian" },
  { year: "2017", title: "Best in Group", detail: "Poodle" },
  { year: "2019", title: "Best in Show", detail: "Bichon" },
] as const;

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="Precision. Patience. Purpose."
      title={
        <>
          The Story Behind
          <br />
          K9 Atelier
        </>
      }
      intro="Penny is the groomer behind K9 Atelier. The name reflects a workshop of craftsmanship — skill refined with care, and each result approached with intention."
    >
      <div className="mx-auto max-w-3xl">
        <ul className="space-y-0">
          {highlights.map((item) => (
            <li
              key={item}
              className="border-t border-champagne/50 py-6 font-body text-base leading-relaxed text-taupe md:text-[17px]"
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-champagne/50 pt-10">
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-deep-lavender">
            Show honors
          </h2>
          <ul className="mt-6">
            {honors.map((honor) => (
              <li
                key={`${honor.year}-${honor.detail}`}
                className="grid gap-1 border-t border-gray-line/80 py-5 md:grid-cols-[88px_1fr] md:items-baseline md:gap-6"
              >
                <p className="font-display text-2xl text-ink">{honor.year}</p>
                <p className="font-body text-base text-taupe">
                  {honor.title} · {honor.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <p className="font-body mt-10 text-base leading-relaxed text-taupe md:text-[17px]">
          Today, that same standard continues at K9 Atelier — a private,
          cage-free mobile pet spa in Palm Beach.
        </p>
      </div>

      <blockquote className="font-display mx-auto mt-16 max-w-3xl border-l border-champagne px-8 py-2 text-center text-2xl leading-snug text-ink italic md:text-3xl">
        &ldquo;Because your dog deserves more than a groomer.
        <br className="hidden sm:block" />
        They deserve a grooming artisan.&rdquo;
      </blockquote>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <LuxuryButton href="/services" variant="secondary">
          Explore Services
        </LuxuryButton>
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Book an Appointment
        </BookServiceLink>
      </div>
    </PageShell>
  );
}
