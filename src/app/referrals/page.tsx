import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";
import {
  REFERRAL_HEADLINE,
  REFERRAL_INTRO,
  REFERRAL_TAGLINE,
  REFERRAL_TERMS,
} from "@/lib/referrals/copy";

export const metadata = {
  title: "Referral Rewards · K9 Atelier",
  description:
    "Share a K9 Atelier referral code. New client households receive 10% off eligible services on their first completed visit, and you earn equal Referral Credit.",
};

export default function ReferralsPage() {
  return (
    <PageShell
      eyebrow="Referral Rewards"
      title={REFERRAL_HEADLINE}
      intro={REFERRAL_TAGLINE}
    >
      <div className="mx-auto max-w-3xl space-y-10">
        <section className="space-y-4">
          {REFERRAL_INTRO.map((paragraph) => (
            <p
              key={paragraph}
              className="font-body text-base leading-relaxed text-ink"
            >
              {paragraph}
            </p>
          ))}
        </section>

        <section className="space-y-4">
          {REFERRAL_TERMS.map((term) => (
            <article
              key={term.title}
              className="border border-gray-line/80 bg-ivory p-6 md:p-8"
            >
              <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
                {term.title}
              </h2>
              <p className="font-body mt-4 text-base leading-relaxed text-ink">
                {term.body}
              </p>
            </article>
          ))}
        </section>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
            Book an Appointment
          </BookServiceLink>
          <LuxuryButton href="/account/referrals" variant="secondary">
            View My Referral Codes
          </LuxuryButton>
        </div>
        <p className="text-center text-sm text-taupe">
          Questions?{" "}
          <Link href="/faq" className="underline decoration-champagne/70 underline-offset-4">
            Read the FAQ
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="underline decoration-champagne/70 underline-offset-4">
            contact the Atelier
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
