import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";

export const metadata = {
  title: "About · K9 Atelier",
  description:
    "The story behind K9 Atelier — a cage-free Private Mobile Pet Spa in Palm Beach, built on precision, patience, and purpose.",
};

const timeline = [
  {
    year: "2010",
    title: "The Journey Begins",
    body: "Penny begins her professional grooming career and builds a strong foundation in grooming technique, coat care, and finishing.",
  },
  {
    year: "2014",
    title: "Education & Craft",
    body: "Penny becomes an instructor at a professional grooming academy in Shanghai, teaching Asian Fusion styling and show grooming.",
  },
  {
    year: "2014–2019",
    title: "Competition Grooming",
    body: "Through professional grooming competitions, Penny develops her experience working with Pomeranians, Poodles, and Shih Tzus while continuing to refine her technique and attention to detail.",
  },
  {
    year: "2019",
    title: "Best in Show",
    body: "Penny receives Best in Show, the highest honor of her competitive grooming career.",
  },
  {
    year: "2020",
    title: "A New Chapter",
    body: "Penny moves to the United States with her infant son, beginning a new chapter while continuing her commitment to thoughtful, skilled grooming.",
  },
  {
    year: "TODAY",
    title: "K9 Atelier · Palm Beach",
    body: [
      "K9 Atelier is a private, cage-free mobile pet spa offering calm, one-on-one grooming appointments in Palm Beach.",
      "Each appointment is tailored to the individual dog, with careful attention to comfort, coat condition, skin health, and a well-balanced finish.",
    ],
  },
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
      intro={
        <>
          <p>
            The name &ldquo;Atelier&rdquo; reflects the care and craftsmanship
            behind our work. It is a place where skills are refined, details are
            considered, and each result is approached with intention.
          </p>
          <p className="mt-4">
            This philosophy continues to guide every K9 Atelier appointment
            today.
          </p>
        </>
      }
    >
      <div className="mx-auto max-w-3xl space-y-10">
        {timeline.map((item) => (
          <article
            key={item.year}
            className="grid gap-4 border-t border-champagne/50 pt-8 md:grid-cols-[120px_1fr]"
          >
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-deep-lavender">
              {item.year}
            </p>
            <div>
              <h2 className="font-display text-2xl text-ink">{item.title}</h2>
              {(Array.isArray(item.body) ? item.body : [item.body]).map(
                (paragraph) => (
                  <p
                    key={paragraph}
                    className="font-body mt-3 text-base leading-relaxed text-taupe first:mt-3"
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </div>
          </article>
        ))}
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
