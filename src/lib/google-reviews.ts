import businessData from "../../content/business.json";
import type { ReviewItem } from "@/lib/reviews";

type AuthorAttribution = { displayName?: string; uri?: string; photoUri?: string };
type GoogleReview = { rating?: number; text?: { text?: string }; originalText?: { text?: string }; authorAttribution?: AuthorAttribution; relativePublishTimeDescription?: string; publishTime?: string; googleMapsUri?: string };
type GooglePlace = { displayName?: { text?: string }; googleMapsUri?: string; reviews?: GoogleReview[] };
type SearchResponse = { places?: GooglePlace[] };

export type GoogleReviewItem = ReviewItem & {
  authorUri?: string;
  authorPhotoUri?: string;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  googleMapsUri?: string;
};

const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function getGoogleReviews(): Promise<GoogleReviewItem[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const textQuery = `${businessData.brand.searchName} ${businessData.brand.phone} ${businessData.serviceArea.publicLocality} ${businessData.serviceArea.publicRegion}`;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.displayName,places.googleMapsUri,places.reviews",
      },
      body: JSON.stringify({ textQuery, maxResultCount: 5 }),
      next: { revalidate: 21600 },
    });

    if (!response.ok) return [];
    const data = (await response.json()) as SearchResponse;
    const place = data.places?.find((candidate) => normalize(candidate.displayName?.text).startsWith("k9 atelier"));
    if (!place?.reviews?.length) return [];

    return place.reviews.flatMap((review) => {
      const quote = review.text?.text || review.originalText?.text;
      if (!quote) return [];
      return [{
        quote,
        name: review.authorAttribution?.displayName || "Google Maps reviewer",
        source: "Google",
        rating: review.rating,
        authorUri: review.authorAttribution?.uri,
        authorPhotoUri: review.authorAttribution?.photoUri,
        relativePublishTimeDescription: review.relativePublishTimeDescription,
        publishTime: review.publishTime,
        googleMapsUri: review.googleMapsUri || place.googleMapsUri,
      }];
    });
  } catch {
    return [];
  }
}
