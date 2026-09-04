import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";
import { StarRating } from "@/components/reviews/StarRating";
import { getGoogleProfileUrl, getGoogleWriteReviewUrl } from "@/lib/business";
import { getGoogleReviews, type GoogleReviewItem } from "@/lib/google-reviews";
import { reviews } from "@/lib/reviews";

const googleBtnClass =
  "inline-flex min-h-[52px] items-center justify-center rounded-sm px-8 text-[12px] font-medium uppercase tracking-[0.16em] transition duration-500 ease-out";

export async function ReviewsShowcase() {
  const profileUrl = getGoogleProfileUrl();
  const writeReviewUrl = getGoogleWriteReviewUrl();
  const googleReviews = await getGoogleReviews();
  const items: GoogleReviewItem[] = googleReviews.length > 0 ? googleReviews : reviews.items;

  return (
    <>
      {items.length > 0 ? (
        <ul className="grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <li key={`${item.name}-${item.quote.slice(0, 24)}`} className="flex flex-col border border-gray-line/80 bg-ivory px-6 py-8">
              <div className="flex items-center gap-3">
                {item.authorPhotoUri ? (
                  <img src={item.authorPhotoUri} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : null}
                <div>
                  {item.authorUri ? (
                    <a href={item.authorUri} target="_blank" rel="noopener noreferrer" className="font-body text-sm font-medium text-ink hover:underline">{item.name}</a>
                  ) : (
                    <p className="font-body text-sm font-medium text-ink">{item.name}</p>
                  )}
                  <p className="font-body mt-0.5 text-[10px] uppercase tracking-[0.16em] text-taupe">{item.source || "Google"}</p>
                </div>
              </div>
              {typeof item.rating === "number" ? <div className="mt-5"><StarRating rating={item.rating} /></div> : null}
              <blockquote className="font-display mt-5 text-xl leading-snug text-ink">&ldquo;{item.quote}&rdquo;</blockquote>
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="font-body text-[11px] text-taupe">{item.relativePublishTimeDescription || ""}</p>
                {item.googleMapsUri ? (
                  <a href={item.googleMapsUri} target="_blank" rel="noopener noreferrer" className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-taupe hover:text-ink">View on Google</a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto max-w-2xl border border-gray-line/80 bg-ivory px-8 py-12 text-center">
          <p className="font-body text-sm leading-relaxed text-taupe">Your feedback is invaluable to us. We cherish every experience you have with K9 ATELIER and invite you to tell us how we can serve you even better.</p>
        </div>
      )}

      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        {writeReviewUrl ? <a href={writeReviewUrl} target="_blank" rel="noopener noreferrer" className={`${googleBtnClass} bg-deep-lavender text-ivory hover:bg-ink`}>Review on Google</a> : null}
        {profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer" className={`${googleBtnClass} border border-champagne bg-transparent text-ink hover:border-ink`}>{writeReviewUrl ? "View on Google" : "Find us on Google"}</a> : null}
      </div>
    </>
  );
}

export function HomeReviews() {
  return (
    <section id="kind-words" className="scroll-mt-24 border-b border-gray-line/60 py-16 md:py-24">
      <Container>
        <SectionIntro eyebrow={reviews.eyebrow} title={reviews.title} body={reviews.intro} />
        <div className="mt-14"><ReviewsShowcase /></div>
      </Container>
    </section>
  );
}
