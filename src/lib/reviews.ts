import reviewsData from "../../content/reviews.json";

export type ReviewItem = {
  quote: string;
  name: string;
  source?: string;
  rating?: number;
  petName?: string;
};

export type ReviewsContent = {
  eyebrow: string;
  title: string;
  intro: string;
  recentItems: ReviewItem[];
  items: ReviewItem[];
};

export const reviews: ReviewsContent = reviewsData;
