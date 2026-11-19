import React from "react";
import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { getGoogleProfileUrl, getGoogleWriteReviewUrl } from "@/lib/business";
import { getGoogleReviews, type GoogleReviewItem } from "@/lib/google-reviews";
import { reviews } from "@/lib/reviews";

const googleBtnClass =
  "inline-flex min-h-[52px] items-center justify-center rounded-sm px-8 text-[12px] font-medium uppercase tracking-[0.16em] transition duration-500 ease-out";

export async function ReviewsShowcase() {
  const profileUrl = getGoogleProfileUrl();
  const writeReviewUrl = getGoogleWriteReviewUrl();
  const googleReviews = await getGoogleReviews();
  const reviewKey = (item: GoogleReviewItem) =>
    `${item.name.trim().toLowerCase()}:${item.quote.replace(/\s+/g, " ").trim()}`;
  const liveItems = googleReviews.length > 0 ? googleReviews : reviews.items;
  const items = new Map<string, GoogleReviewItem>(
    reviews.recentItems.map((item) => [reviewKey(item), { ...item, googleMapsUri: profileUrl ?? undefined }]),
  );
  for (const item of liveItems) items.set(reviewKey(item), item);

  return (
    <>
      {items.size > 0 ? (
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-4 lg:gap-6">
          {Array.from(items, ([key, item]) => (
            <ReviewCard key={key} item={item} />
          ))}
        </ul>
      ) : (
        <div className="mx-auto max-w-2xl border border-gray-line/80 bg-ivory px-8 py-12 text-center">
          <p className="font-body text-sm leading-relaxed text-ink">
            Share your experience on Google.
          </p>
        </div>
      )}

      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        {writeReviewUrl ? (
          <a href={writeReviewUrl} target="_blank" rel="noopener noreferrer" className={`${googleBtnClass} bg-deep-lavender text-ivory hover:bg-ink`}>
            Review on Google
          </a>
        ) : null}
        {profileUrl ? (
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className={`${googleBtnClass} border border-champagne bg-transparent text-ink hover:border-ink`}>
            {writeReviewUrl ? "View on Google" : "Find us on Google"}
          </a>
        ) : null}
      </div>
    </>
  );
}

export function HomeReviews() {
  return (
    <section id="kind-words" className="scroll-mt-24 border-b border-gray-line/60 py-16 md:py-24">
      <Container>
        <SectionIntro eyebrow={reviews.eyebrow} title={reviews.title} body={reviews.intro} />
        <div className="mt-14">
          <ReviewsShowcase />
        </div>
      </Container>
    </section>
  );
}
