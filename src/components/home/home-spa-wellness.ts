export const homeSpaWellnessIntro = {
  eyebrow: "Spa & Wellness",
  title: "Care for Skin, Coat & Comfort",
  body: "Targeted spa treatments selected for your dog’s skin and coat needs.",
  note: "Spa Rituals are scheduled separately from full haircut appointments.",
  ctaLabel: "View Spa Services & Pricing",
  ctaHref: "/services#spa-wellness",
} as const;

export const homeSpaWellnessServices = [
  {
    id: "dead-sea-mineral-ritual",
    title: "Dead Sea Mineral Ritual",
    suitability: "For heavy shedding and dense double coats.",
    details:
      "Mineral-rich Dead Sea mud care paired with gentle body massage and meticulous coat finishing.",
  },
  {
    id: "lavender-chamomile-bath-ritual",
    title: "Lavender & Chamomile Bath Ritual",
    suitability: "For dry, dull or tangle-prone coats.",
    details:
      "A warm bathing ritual with pet-appropriate lavender and chamomile care, paired with gentle massage and careful coat finishing.",
  },
  {
    id: "sensitive-skin-botanical-ritual",
    title: "Sensitive Skin Botanical Ritual",
    suitability: "For dry or sensitive skin.",
    details:
      "Gentle botanical and oatmeal/aloe-based care created for dogs with dry or sensitive skin.",
  },
] as const;

export type HomeSpaWellnessService =
  (typeof homeSpaWellnessServices)[number];

export function spaDetailsToggleLabel(expanded: boolean) {
  return expanded ? "Hide Details" : "View Details";
}
