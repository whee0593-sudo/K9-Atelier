import {
  business,
  formatDuration,
  formatPrice,
  getBrandWebsiteUrl,
} from "@/lib/business";
import {
  allBookableServices,
  type BookableService,
  type ServiceTier,
} from "@/lib/services";

export const SERVICES_PATH = "/services";
export const FULL_GROOM_PATH = "/services/full-groom";
export const HAND_STRIPPING_PATH = "/services/hand-stripping";
export const BATH_COAT_PATH = "/services/bath-coat-care";
export const SPA_PATH = "/services/spa";
export const COLOR_PATH = "/services/color";
export const SPECIALTY_CARE_PATH = "/services/specialty-care";
export const ADD_ONS_PATH = "/services/add-ons";
export const FEES_POLICIES_PATH = "/faq#fees-policies";
export const CONSULTATION_PATH = "/contact?inquiry=grooming-consultation";

export const SERVICES_PAGE_TITLE = "Services · K9 Atelier";
export const SERVICES_PAGE_DESCRIPTION =
  "A considered menu of private mobile grooming — bath and coat care, full grooming, hand stripping, spa rituals, color, specialty care, and finishing add-ons in Palm Beach.";

export const FULL_GROOM_PAGE_TITLE = "Full Grooming | K9 Atelier";
export const FULL_GROOM_PAGE_DESCRIPTION =
  "Custom full grooming and haircuts tailored to coat, lifestyle, and expression. Private mobile grooming serving Jupiter, Palm Beach Gardens and surrounding Palm Beach areas.";
export const FULL_GROOM_PAGE_H1 = "A Complete Style, Done With Patience.";
export const FULL_GROOM_PAGE_INTRO =
  "Custom haircuts for coats that need more than a bath.";

export const HAND_STRIPPING_PAGE_TITLE = "Hand Stripping | K9 Atelier";
export const HAND_STRIPPING_PAGE_DESCRIPTION =
  "Traditional hand stripping for suitable wire-coated breeds, preserving harsh texture, color, and natural coat protection. Private mobile grooming serving Jupiter, Palm Beach Gardens and surrounding Palm Beach areas.";
export const HAND_STRIPPING_PAGE_H1 = "Hand Stripping";
export const HAND_STRIPPING_PAGE_INTRO =
  "Traditional coat maintenance for wire-coated breeds, preserving harsh texture, color, and natural coat protection.";

export function absoluteSiteUrl(path: string) {
  const origin = getBrandWebsiteUrl().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export const BATH_COAT_IDS = [
  "signature-bath-care",
  "long-coat-show-care",
] as const;

export const FULL_GROOM_IDS = ["custom-full-haircut"] as const;

export const HAND_STRIPPING_IDS = ["hand-stripping"] as const;

export const SPA_IDS = [
  "dead-sea-mud-bath",
  "aromatherapy-oil-bath",
  "sensitive-skin-treatment",
] as const;

export const COLOR_IDS = ["creative-accent-coloring"] as const;

export const SPECIALTY_IDS = [
  "senior-comfort-care",
  "end-of-life-care",
] as const;

export const ADD_ON_IDS = [
  "dematting-brush-out",
  "deshedding-treatment",
  "mini-trim",
] as const;

export const SERVICE_ANCHORS: Record<string, string> = {
  "signature-bath-care": "signature-bath",
  "custom-full-haircut": "atelier-full-groom",
};

export type ServiceCategorySlug =
  | "bath-coat-care"
  | "full-groom"
  | "hand-stripping"
  | "spa"
  | "color"
  | "specialty-care"
  | "add-ons";

export type ServiceCategory = {
  slug: ServiceCategorySlug;
  path: string;
  navLabel: string;
  directoryName: string;
  directoryDescription: string;
  showStartingPrice: boolean;
  serviceIds: readonly string[];
  layout: "cards" | "coloring";
  pageTitle: string;
  pageDescription: string;
  pageEyebrow: string;
  pageH1: string;
  pageIntro: string;
};

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  {
    slug: "bath-coat-care",
    path: BATH_COAT_PATH,
    navLabel: "Bath & Coat",
    directoryName: "Bath & Coat Care",
    directoryDescription: "Bathing · Coat maintenance",
    showStartingPrice: true,
    serviceIds: BATH_COAT_IDS,
    layout: "cards",
    pageTitle: "Bath & Coat Care | K9 Atelier",
    pageDescription:
      "Signature bathing and weekly long-coat care, tailored to texture, length, and how your dog lives. Private mobile grooming in Palm Beach.",
    pageEyebrow: "Bath & Coat Care",
    pageH1: "Coat Health, Kept Beautiful.",
    pageIntro:
      "Foundational bathing and weekly long-coat care, tailored to texture, length, and how your dog lives.",
  },
  {
    slug: "full-groom",
    path: FULL_GROOM_PATH,
    navLabel: "Full Grooming",
    directoryName: "Full Grooming",
    directoryDescription: "Haircuts · Styling",
    showStartingPrice: true,
    serviceIds: FULL_GROOM_IDS,
    layout: "cards",
    pageTitle: FULL_GROOM_PAGE_TITLE,
    pageDescription: FULL_GROOM_PAGE_DESCRIPTION,
    pageEyebrow: "Full Grooming",
    pageH1: FULL_GROOM_PAGE_H1,
    pageIntro: FULL_GROOM_PAGE_INTRO,
  },
  {
    slug: "hand-stripping",
    path: HAND_STRIPPING_PATH,
    navLabel: "Hand Stripping",
    directoryName: "Hand Stripping",
    directoryDescription: "Traditional coat maintenance",
    showStartingPrice: false,
    serviceIds: HAND_STRIPPING_IDS,
    layout: "cards",
    pageTitle: HAND_STRIPPING_PAGE_TITLE,
    pageDescription: HAND_STRIPPING_PAGE_DESCRIPTION,
    pageEyebrow: "Hand Stripping",
    pageH1: HAND_STRIPPING_PAGE_H1,
    pageIntro: HAND_STRIPPING_PAGE_INTRO,
  },
  {
    slug: "spa",
    path: SPA_PATH,
    navLabel: "Spa Rituals",
    directoryName: "Spa Rituals",
    directoryDescription: "Skin · Coat · Wellness",
    showStartingPrice: true,
    serviceIds: SPA_IDS,
    layout: "cards",
    pageTitle: "Spa Rituals | K9 Atelier",
    pageDescription:
      "Quiet spa rituals for skin, coat, and comfort. Private mobile wellness baths in Palm Beach, scheduled separately from full haircut appointments.",
    pageEyebrow: "Spa Rituals",
    pageH1: "Quiet Rituals for Skin, Coat & Comfort.",
    pageIntro:
      "Spa Rituals include a complete wellness bath experience and are best scheduled separately from full haircut appointments to prevent over-tiring your dog.",
  },
  {
    slug: "color",
    path: COLOR_PATH,
    navLabel: "Creative Color",
    directoryName: "Creative Color",
    directoryDescription: "Pet-safe color artistry",
    showStartingPrice: true,
    serviceIds: COLOR_IDS,
    layout: "coloring",
    pageTitle: "Creative Color | K9 Atelier",
    pageDescription:
      "Pet-safe, semi-permanent accent color designed specifically for animal coats. Private mobile grooming in Palm Beach.",
    pageEyebrow: "Creative Color",
    pageH1: "A Playful, Pet-Safe Finish.",
    pageIntro:
      "Pet-safe, semi-permanent accent color designed specifically for animal coats.",
  },
  {
    slug: "specialty-care",
    path: SPECIALTY_CARE_PATH,
    navLabel: "Specialty Care",
    directoryName: "Specialty Care",
    directoryDescription: "Senior · Comfort care",
    showStartingPrice: false,
    serviceIds: SPECIALTY_IDS,
    layout: "cards",
    pageTitle: "Specialty Care | K9 Atelier",
    pageDescription:
      "Unhurried senior comfort care and gentle end-of-life grooming for dogs who need a slower, quieter appointment.",
    pageEyebrow: "Specialty Care",
    pageH1: "Comfort, Dignity, and Unhurried Time.",
    pageIntro:
      "For dogs who need a slower pace — whether for age, recovery, or a quieter last chapter.",
  },
  {
    slug: "add-ons",
    path: ADD_ONS_PATH,
    navLabel: "Add-On Care",
    directoryName: "Add-On Care",
    directoryDescription: "Finishing · Coat support",
    showStartingPrice: true,
    serviceIds: ADD_ON_IDS,
    layout: "cards",
    pageTitle: "Add-On Care | K9 Atelier",
    pageDescription:
      "Finishing and coat-support add-ons — dematting, deshedding, and mini trims — reserved with a bath, spa, or grooming appointment.",
    pageEyebrow: "Add-On Care",
    pageH1: "Small Refinements, When Needed.",
    pageIntro:
      "Added to a bath, show-care, spa, or full grooming appointment as needed.",
  },
];

export const SERVICE_CATEGORY_PATHS = SERVICE_CATEGORIES.map(
  (category) => category.path,
);

export function getServiceCategory(slug: string) {
  return SERVICE_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

const CARD_SUMMARIES: Record<string, string> = {
  "signature-bath-care":
    "Essential coat and hygiene care tailored to your dog’s coat type.",
  "custom-full-haircut":
    "A complete grooming experience finished with a custom haircut tailored to coat, lifestyle, and expression.",
  "long-coat-show-care":
    "Weekly maintenance for full-coat breeds, preserving length and preventing matting between appointments.",
  "hand-stripping":
    "Traditional hand stripping for wire-coated breeds, preserving harsh texture, color, and natural coat protection.",
  "dead-sea-mud-bath":
    "Mineral-rich Dead Sea mud care paired with gentle body massage and meticulous coat finishing.",
  "aromatherapy-oil-bath":
    "A warm bathing ritual with pet-appropriate lavender and chamomile care, paired with gentle massage.",
  "sensitive-skin-treatment":
    "Gentle botanical and oatmeal/aloe-based care created for dogs with dry or sensitive skin.",
  "dematting-brush-out":
    "Patient, skin-safe mat removal for light to moderate tangles, always prioritizing your dog’s comfort.",
  "deshedding-treatment":
    "A deep undercoat treatment to release trapped hair and reduce shedding after the bath.",
  "senior-comfort-care":
    "Low-stress, adapted care for senior or medically fragile dogs who need a slower, gentler appointment.",
  "mini-trim": "Eyes, feet & sanitary areas only.",
  "creative-accent-coloring":
    "Pet-safe, semi-permanent accent color designed specifically for animal coats.",
  "end-of-life-care":
    "Compassionate, low-stress comfort grooming that places dignity ahead of cosmetic results.",
};

const CARD_BEST_FOR: Record<string, string> = {
  "signature-bath-care": "Regular coat maintenance",
  "custom-full-haircut": "A complete haircut and style",
  "long-coat-show-care": "Full-coat breeds on a weekly schedule",
  "hand-stripping": "Wire-coated Terriers and Schnauzers",
  "dead-sea-mud-bath": "Heavy double coats and high-shedding breeds",
  "aromatherapy-oil-bath": "Dry, dull, or tangle-prone coats",
  "sensitive-skin-treatment": "Sensitive, dry, or irritated skin",
  "dematting-brush-out": "Light to moderate tangles",
  "deshedding-treatment": "Heavy-shedding double coats",
  "senior-comfort-care": "Senior or medically fragile dogs",
  "mini-trim": "Quick tidy between full grooms",
  "creative-accent-coloring": "A playful, pet-safe pop of color",
  "end-of-life-care": "Comfort-first visits in a dog’s final chapter",
};

export const SERVICES_NAV = SERVICE_CATEGORIES.map((category) => ({
  href: category.path,
  sectionId: category.slug,
  label: category.navLabel,
}));

/** Old in-page hashes that now have dedicated category or FAQ routes. */
export const SERVICES_HASH_ROUTES: Record<string, string> = {
  "most-requested": SERVICES_PATH,
  "bath-coat": BATH_COAT_PATH,
  "signature-bath": BATH_COAT_PATH,
  "full-groom": FULL_GROOM_PATH,
  "atelier-full-groom": FULL_GROOM_PATH,
  "hand-stripping": HAND_STRIPPING_PATH,
  "spa-rituals": SPA_PATH,
  "spa-wellness": SPA_PATH,
  "color-dye": COLOR_PATH,
  "specialty-care": SPECIALTY_CARE_PATH,
  "gentle-care": SPECIALTY_CARE_PATH,
  "add-ons": ADD_ONS_PATH,
  "fees-policies": FEES_POLICIES_PATH,
};

export function getServiceById(id: string) {
  return allBookableServices().find((service) => service.id === id) ?? null;
}

export function getServicesByIds(ids: readonly string[]) {
  return ids
    .map((id) => getServiceById(id))
    .filter((service): service is BookableService => service != null);
}

export function serviceCardSummary(service: BookableService) {
  return CARD_SUMMARIES[service.id] ?? firstSentences(service.description, 35);
}

export function serviceCardBestFor(service: BookableService) {
  return CARD_BEST_FOR[service.id] ?? shortenBestFor(service.bestFor);
}

export function serviceCardPriceValue(service: BookableService) {
  return serviceStartingPriceLabel(service).replace(/^From\s+/i, "");
}

export function serviceStartingPriceAmount(service: BookableService) {
  if (service.pricingType === "hourly" && service.hourlyRate != null) {
    return service.hourlyRate;
  }
  if (service.pricingType === "options" && service.options?.length) {
    const priced = service.options.filter((option) => option.priceFrom != null);
    if (!priced.length) return null;
    return Math.min(...priced.map((option) => option.priceFrom!));
  }
  if (service.pricingType === "add_on" && service.flatRate != null) {
    return service.flatRate;
  }
  if (service.pricingType === "add_on" && service.tiers?.length) {
    return Math.min(...service.tiers.map((tier) => tier.priceFrom));
  }
  if (service.pricingType === "tiered" && service.coatTypePrices?.length) {
    return Math.min(...service.coatTypePrices.map((tier) => tier.priceFrom));
  }
  if (service.pricingType === "tiered" && service.tiers?.length) {
    return Math.min(...service.tiers.map((tier) => tier.priceFrom));
  }
  return null;
}

export function serviceStartingPriceLabel(service: BookableService) {
  if (service.pricingType === "free") return "Complimentary";
  if (service.pricingType === "consultation") return "By consultation";
  if (service.pricingType === "hourly" && service.hourlyRate) {
    return `From ${formatPrice(service.hourlyRate)} / hour`;
  }
  if (service.pricingType === "options" && service.options?.length) {
    const priced = service.options.filter((option) => option.priceFrom != null);
    if (priced.length) {
      const min = Math.min(...priced.map((option) => option.priceFrom!));
      return `From ${formatPrice(min)}`;
    }
    return "Consultation required";
  }
  if (service.pricingType === "add_on" && service.flatRate != null) {
    if (service.durationMin != null) {
      return `From ${formatPrice(service.flatRate)} / ${service.durationMin} min`;
    }
    return `From ${formatPrice(service.flatRate)}`;
  }
  if (service.pricingType === "add_on" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((tier) => tier.priceFrom));
    return `From ${formatPrice(min)}`;
  }
  if (service.pricingType === "tiered" && service.coatTypePrices?.length) {
    const min = Math.min(...service.coatTypePrices.map((tier) => tier.priceFrom));
    return `From ${formatPrice(min)}`;
  }
  if (service.pricingType === "tiered" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((tier) => tier.priceFrom));
    return `From ${formatPrice(min)}`;
  }
  return "";
}

/** Lowest starting price across a category, from the shared catalog. */
export function categoryStartingPriceLabel(serviceIds: readonly string[]) {
  const amounts = getServicesByIds(serviceIds)
    .map(serviceStartingPriceAmount)
    .filter((amount): amount is number => amount != null);
  if (!amounts.length) return null;
  return `From ${formatPrice(Math.min(...amounts))}`;
}

export function directoryPriceLabel(category: ServiceCategory) {
  if (!category.showStartingPrice) return null;
  return categoryStartingPriceLabel(category.serviceIds);
}

export function serviceCardAccessLabel(service: BookableService) {
  if (service.membersOnly) return "Members only";
  return null;
}

export function serviceDurationLabel(service: BookableService) {
  if (service.durationNote) return service.durationNote;
  if (service.pricingType === "free") return "By appointment only";
  if (service.pricingType === "hourly") {
    return formatDuration(service.durationMin ?? 60, service.durationMax);
  }
  if (service.tiers?.some((tier) => tier.durationMin != null)) {
    return durationRangeFromTiers(service.tiers);
  }
  if (service.durationMin != null) {
    return formatDuration(service.durationMin, service.durationMax);
  }
  return null;
}

export function durationRangeFromTiers(tiers: ServiceTier[]) {
  const mins = tiers
    .map((tier) => tier.durationMin)
    .filter((value): value is number => value != null);
  const maxes = tiers
    .map((tier) => tier.durationMax ?? tier.durationMin)
    .filter((value): value is number => value != null);
  if (!mins.length) return null;
  return formatDuration(Math.min(...mins), Math.max(...maxes));
}

export function getSpaTreatmentsIntro() {
  const category = business.serviceCategories.find(
    (item) => "spaTreatments" in item,
  ) as
    | {
        spaTreatments?: { note?: string; includesAll?: string[] };
      }
    | undefined;
  return category?.spaTreatments ?? null;
}

export function spaIncludesItems() {
  const intro = getSpaTreatmentsIntro();
  const raw = intro?.includesAll ?? [];
  return raw.flatMap((item) => splitCombinedList(item));
}

export function coloringOptionDisplayNote(note?: string) {
  if (!note) return null;
  const stripped = note
    .replace(/^From\s+\$[\d.]+(?:\s*·\s*)?/i, "")
    .replace(/^\$[\d.]+(?:\s*\(([^)]+)\))?/i, (_, inner: string | undefined) =>
      inner ? inner : "",
    )
    .replace(/^[/\s·]+/, "")
    .trim();
  return stripped || null;
}

export function coloringOptionPriceLabel(option: {
  priceFrom?: number;
  consultationRequired?: boolean;
  note?: string;
}) {
  if (option.consultationRequired) return "Consultation required";
  if (option.priceFrom == null) return "—";
  const extra = coloringOptionDisplayNote(option.note) ?? "";
  const unit = /section/i.test(extra) ? " / section" : "";
  return `From ${formatPrice(option.priceFrom)}${unit}`;
}

function firstSentences(text: string, maxWords: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  const words = compact.split(" ");
  if (words.length <= maxWords) return compact;
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;]+$/, "")}.`;
}

function shortenBestFor(value?: string) {
  if (!value) return null;
  const first = value.split("—")[0]?.trim();
  return first || value;
}

function splitCombinedList(value: string) {
  if (!value.includes(",") && !value.includes(" and ")) return [value];
  return value
    .replace(/\band\b/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
