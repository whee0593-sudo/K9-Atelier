import { business } from "./business";

/** Customer-facing presentation names — backend service IDs unchanged. */
export const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "signature-bath-care": "Signature Bath",
  "custom-full-haircut": "The Atelier Full Groom",
  "show-level-coat-care": "Show-Level Coat Care",
  "long-coat-show-care": "Show-Level Coat Care",
  "hand-stripping": "Hand Stripping",
  "luxury-spa-day": "Luxury Spa Day",
  "dead-sea-mud-bath": "Dead Sea Mud Bath Treatment",
  "aromatherapy-oil-bath": "Aromatherapy Essential Oil Bath Soak",
  "sensitive-skin-treatment": "Sensitive Skin & Dander Soothing Treatment",
  "creative-accent-coloring": "Creative Accent Color",
  "deshedding-treatment": "DeShedding Care",
  "dematting-brush-out": "Gentle DeMatting",
  "senior-comfort-care": "Extra-Gentle Senior Care",
  "mini-trim": "Mini Trim",
  "end-of-life-care": "End-of-Life Comfort Care",
};

export const SERVICE_DISPLAY_DESCRIPTIONS: Record<string, string> = {
  "signature-bath-care":
    "Bath, blow-dry, and brush-out. Nail, ear, and teeth care included.",
  "custom-full-haircut":
    "Complete grooming with bespoke haircut and finishing.",
  "show-level-coat-care":
    "An upgraded bath with show-level coat conditioning, on a weekly schedule. Nail, ear, teeth care and mini trim included.",
  "long-coat-show-care":
    "An upgraded bath with show-level coat conditioning, on a weekly schedule. Nail, ear, teeth care and mini trim included.",
  "hand-stripping":
    "Traditional coat preservation for wire-haired breeds.",
  "luxury-spa-day":
    "A fully customized, relaxing spa experience for your pup. Nail, ear, and teeth care included. Mini trim included.",
  "creative-accent-coloring":
    "A bespoke pop of pet-appropriate color, tailored to your dog's coat and your preferred look.",
  "deshedding-treatment": "For coats with excess undercoat.",
  "dematting-brush-out":
    "Gentle removal of light to moderate tangles, with your dog's comfort and coat health as the priority.",
  "senior-comfort-care":
    "Additional time and adapted handling for comfort and an unhurried pace.",
  "mini-trim": "Eyes, feet & sanitary areas only.",
};

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  "bath-show-spa": "Bath, Coat Care & Spa",
  "full-grooming": "Full Grooming & Hand Stripping",
  "add-on-care": "Add-On Care",
  "bath-grooming": "Signature Grooming",
  "spa-wellness": "Luxury Spa Day",
  "creative-accent-coloring": "Creative Accent Color",
  "end-of-life-care": "Gentle Care",
};

export function getServiceDisplayName(serviceId: string, fallback: string) {
  const service = business.serviceCategories
    .map((category) => category.services.find((item) => item.id === serviceId))
    .find((item) => item != null);
  if (serviceId === "senior-comfort-care") return "Extra-Gentle Senior Care";
  return service?.name ?? SERVICE_DISPLAY_NAMES[serviceId] ?? fallback;
}

export function getCatalogItemDisplayLabel(
  catalogId: string | undefined,
  fallback: string,
) {
  if (catalogId) return getServiceDisplayName(catalogId, fallback);
  if (
    fallback === "Long Coat Show Care" ||
    fallback === "Show Care for Long Coats" ||
    fallback === "Show-Level Long-Coat Care"
  ) {
    return "Show-Level Coat Care";
  }
  return fallback;
}

export function getServiceDisplayDescription(
  serviceId: string,
  fallback: string,
) {
  return SERVICE_DISPLAY_DESCRIPTIONS[serviceId] ?? fallback;
}

export function getCategoryDisplayName(categoryId: string, fallback: string) {
  return CATEGORY_DISPLAY_NAMES[categoryId] ?? fallback;
}
