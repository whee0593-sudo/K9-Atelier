/** Customer-facing presentation names — backend service IDs unchanged. */
export const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "signature-bath-care": "The Signature Bath",
  "custom-full-haircut": "The Atelier Full Groom",
  "long-coat-show-care": "Show Care for Long Coats",
  "hand-stripping": "Hand-Stripping Specialty",
  "dead-sea-mud-bath": "Dead Sea Mineral Ritual",
  "aromatherapy-oil-bath": "Lavender & Chamomile Bath Ritual",
  "sensitive-skin-treatment": "Sensitive Skin Botanical Ritual",
  "creative-accent-coloring": "Creative Accent Color",
  "deshedding-treatment": "DeShedding Care",
  "dematting-brush-out": "Gentle DeMatting",
  "senior-comfort-care": "Gentle Care",
  "mini-trim": "Mini Trim",
  "end-of-life-care": "End-of-Life Comfort Care",
};

export const SERVICE_DISPLAY_DESCRIPTIONS: Record<string, string> = {
  "signature-bath-care":
    "Coat-specific cleansing, conditioning and meticulous finishing.",
  "custom-full-haircut":
    "Complete grooming with bespoke haircut and finishing.",
  "long-coat-show-care":
    "A weekly wash-and-care ritual for full-coat breeds — preserving length, preventing matting, and keeping a silky, show-ready finish.",
  "hand-stripping":
    "Traditional coat preservation for wire-haired breeds.",
  "dead-sea-mud-bath":
    "Mineral-rich care paired with gentle massage and meticulous coat finishing.",
  "aromatherapy-oil-bath":
    "A warm bathing ritual with pet-appropriate lavender and chamomile care.",
  "sensitive-skin-treatment":
    "Gentle botanical care created for dry or sensitive skin.",
  "creative-accent-coloring":
    "A bespoke pop of pet-appropriate color, tailored to your dog's coat and your preferred look.",
  "deshedding-treatment": "For coats with excess undercoat.",
  "dematting-brush-out":
    "Professional coat care when matting requires additional time.",
  "senior-comfort-care":
    "Additional time and adapted handling for comfort and an unhurried pace.",
  "mini-trim":
    "A focused tidy around the eyes, feet, and sanitary area.",
};

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  "bath-show-spa": "Bath, Show Care & Spa",
  "full-grooming": "Full Grooming & Hand Stripping",
  "add-on-care": "Add-On Care",
  "bath-grooming": "Signature Grooming",
  "spa-wellness": "Spa Rituals",
  "creative-accent-coloring": "Creative Accent Color",
  "end-of-life-care": "Gentle Care",
};

export function getServiceDisplayName(serviceId: string, fallback: string) {
  return SERVICE_DISPLAY_NAMES[serviceId] ?? fallback;
}

export function getCatalogItemDisplayLabel(
  catalogId: string | undefined,
  fallback: string,
) {
  if (catalogId) return getServiceDisplayName(catalogId, fallback);
  if (fallback === "Long Coat Show Care") return "Show Care for Long Coats";
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
