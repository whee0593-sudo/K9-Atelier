import { ReviewsShowcase } from "@/components/home/HomeReviews";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";
import { reviews } from "@/lib/reviews";

export const metadata = {
  title: "Reviews · K9 Atelier",
  description:
    "Client kind words for K9 Atelier, a Private Mobile Pet Spa in Palm Beach — and a place to share your experience on Google.",
};

export default function ReviewsPage() {
  return (
    <PageShell
      eyebrow={reviews.eyebrow}
      title={
        <>
          Kind Words,
          <br />
          Quietly Kept.
        </>
      }
      intro={reviews.intro}
    >
      <ReviewsShowcase />
      <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <LuxuryButton href="/services" variant="secondary">
          Explore Services
        </LuxuryButton>
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Book an Appointment
        </BookServiceLink>
      </div>
    </PageShell>
  );
}
