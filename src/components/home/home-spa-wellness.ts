export const homeSpaWellnessIntro = {
  eyebrow: "Spa & Wellness",
  title: "Care for Skin, Coat & Comfort",
  body: "A fully customized, relaxing spa experience for your pup. Nail, ear, and teeth care included. Mini trim included.",
  note: "The groomer chooses the treatments for your dog's coat and comfort.",
  ctaLabel: "View Luxury Spa Day",
  ctaHref: "/services/spa",
} as const;

export const homeSpaWellnessServices = [
  {
    id: "luxury-spa-day",
    title: "Luxury Spa Day",
    suitability: "Nail, ear, and teeth care included",
    details:
      "A fully customized, relaxing spa experience for your pup. Nail, ear, and teeth care included. Mini trim included.",
  },
] as const;

export type HomeSpaWellnessService =
  (typeof homeSpaWellnessServices)[number];

export function spaDetailsToggleLabel(expanded: boolean) {
  return expanded ? "Hide Details" : "View Details";
}
