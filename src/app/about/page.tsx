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
    body: "Penny begins her professional grooming career.",
  },
  {
    year: "2014",
    title: "Education & Craft",
    body: "Teaching Asian-fusion style grooming and Show grooming at a professional grooming academy in Shanghai, China.",
  },
  {
    year: "2014–2019",
    title: "Competition Grooming",
    body: "Competition experience including Pomeranians, Poodles and Shih Tzus.",
  },
  {
    year: "2019",
    title: "Best in Show",
    body: "The highest honor of her grooming competition career.",
  },
  {
    year: "2020",
    title: "A New Chapter",
    body: "Penny moves to the United States with her young son and begins rebuilding her career around the same principles of precision, patience and craft.",
  },
  {
    year: "Today",
    title: "K9 Atelier · Palm Beach",
    body: "A cage-free Private Mobile Pet Spa built around technical expertise, individual attention and genuine care.",
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
            The name &ldquo;Atelier&rdquo; was not chosen by accident. In its
            truest sense, an atelier is a workshop of craftsmanship — a place
            where skill is refined relentlessly, where every detail matters, and
            where good enough is never quite enough.
          </p>
          <p className="mt-4">
            That philosophy sits at the heart of K9 Atelier.
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
              <p className="font-body mt-3 text-base leading-relaxed text-taupe">
                {item.body}
              </p>
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
