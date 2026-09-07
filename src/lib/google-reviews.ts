import businessData from "../../content/business.json";
import type { ReviewItem } from "@/lib/reviews";

type AuthorAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};

type GoogleReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: AuthorAttribution;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  googleMapsUri?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  googleMapsUri?: string;
  reviews?: GoogleReview[];
};

type SearchResponse = { places?: GooglePlace[] };

export type GoogleReviewItem = ReviewItem & {
  authorUri?: string;
  authorPhotoUri?: string;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  googleMapsUri?: string;
};

const normalize = (value = "") =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function getGoogleReviews(): Promise<GoogleReviewItem[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error("Google Places review sync: GOOGLE_PLACES_API_KEY is missing");
    return [];
  }

  const textQuery = `${businessData.brand.searchName} ${businessData.serviceArea.publicLocality} ${businessData.serviceArea.publicRegion}`;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.googleMapsUri,places.reviews",
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 10,
        includePureServiceAreaBusinesses: true,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(
        `Google Places review sync: request failed (${response.status}) ${detail.slice(0, 1000)}`,
      );
      return [];
    }

    const data = (await response.json()) as SearchResponse;
    const candidates = data.places ?? [];
    const place = candidates.find((candidate) => {
      const name = normalize(candidate.displayName?.text);
      return name === "k9 atelier mobile pet spa" || name.startsWith("k9 atelier");
    });

    if (!place) {
      const names = candidates
        .map((candidate) => candidate.displayName?.text)
        .filter(Boolean)
        .join(" | ");
      console.error(
        `Google Places review sync: K9 Atelier not found. Candidates: ${names || "none"}`,
      );
      return [];
    }

    if (!place.reviews?.length) {
      console.error(
        `Google Places review sync: matched ${place.displayName?.text || "K9 Atelier"} (${place.id || "no place id"}), but Google returned no reviews`,
      );
      return [];
    }

    console.info(
      `Google Places review sync: matched ${place.displayName?.text || "K9 Atelier"} (${place.id || "no place id"}) and received ${place.reviews.length} review(s)`,
    );

    return place.reviews.flatMap((review) => {
      const quote = review.text?.text || review.originalText?.text;
      if (!quote) return [];

      return [
        {
          quote,
          name: review.authorAttribution?.displayName || "Google Maps reviewer",
          source: "Google Maps",
          rating: review.rating,
          authorUri: review.authorAttribution?.uri,
          authorPhotoUri: review.authorAttribution?.photoUri,
          relativePublishTimeDescription: review.relativePublishTimeDescription,
          publishTime: review.publishTime,
          googleMapsUri: review.googleMapsUri || place.googleMapsUri,
        },
      ];
    });
  } catch (error) {
    console.error("Google Places review sync: unexpected error", error);
    return [];
  }
}
