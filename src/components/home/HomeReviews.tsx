import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";
import { StarRating } from "@/components/reviews/StarRating";
import { getGoogleProfileUrl, getGoogleWriteReviewUrl } from "@/lib/business";
import { reviews } from "@/lib/reviews";

const googleBtnClass =
  "inline-flex min-h-[52px] items-center justify-center rounded-sm px-8 text-[12px] font-medium uppercase tracking-[0.16em] transition duration-500 ease-out";

export function ReviewsShowcase() {
  const profileUrl = getGoogleProfileUrl();
  const writeReviewUrl = getGoogleWriteReviewUrl();

  return (
    <>
      {reviews.items.length > 0 ? (
        <ul className="grid gap-6 md:grid-cols-3">
          {reviews.items.map((item) => (
            <li
              key={`${item.name}-${item.quote.slice(0, 24)}`}
              className="flex flex-col border border-gray-line/80 bg-ivory px-6 py-8"
            >
              {typeof item.rating === "number" ? (
                <StarRating rating={item.rating} />
              ) : null}
              <blockquote className="font-display mt-5 text-xl leading-snug text-ink">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <p className="font-body mt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
                {item.name}
                {item.petName ? ` · ${item.petName}` : ""}
                {item.source ? ` · ${item.source}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto max-w-2xl border border-gray-line/80 bg-ivory px-8 py-12 text-center">
          <p className="font-body text-sm leading-relaxed text-taupe">
            Your feedback is invaluable to us. We cherish every experience you
            have with K9 ATELIER and invite you to tell us how we can serve you
            even better.
          </p>
        </div>
      )}

      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        {writeReviewUrl ? (
          <a
            href={writeReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${googleBtnClass} bg-deep-lavender text-ivory hover:bg-ink`}
          >
            Review on Google
          </a>
        ) : null}
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${googleBtnClass} border border-champagne bg-transparent text-ink hover:border-ink`}
          >
            {writeReviewUrl ? "View on Google" : "Find us on Google"}
          </a>
        ) : null}
      </div>
    </>
  );
}

export function HomeReviews() {
  return (
    <section
      id="kind-words"
      className="scroll-mt-24 border-b border-gray-line/60 py-16 md:py-24"
    >
      <Container>
        <SectionIntro
          eyebrow={reviews.eyebrow}
          title={reviews.title}
          body={reviews.intro}
        />
        <div className="mt-14">
          <ReviewsShowcase />
        </div>
      </Container>
    </section>
  );
}
