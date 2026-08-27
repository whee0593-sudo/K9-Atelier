import { business, formatDuration, formatPrice } from "@/lib/business";
import {
  allBookableServices,
  type BookableService,
  type ServiceTier,
} from "@/lib/services";

export const MOST_REQUESTED_IDS = [
  "signature-bath-care",
  "custom-full-haircut",
  "long-coat-show-care",
] as const;

export const BATH_COAT_IDS = [
  "signature-bath-care",
  "long-coat-show-care",
] as const;

export const FULL_GROOM_IDS = [
  "custom-full-haircut",
  "hand-stripping",
] as const;

export const SPA_IDS = [
  "dead-sea-mud-bath",
  "aromatherapy-oil-bath",
  "sensitive-skin-treatment",
] as const;

export const ADD_ON_IDS = [
  "dematting-brush-out",
  "deshedding-treatment",
  "mini-trim",
] as const;

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
  "mini-trim":
    "A focused tidy of the eyes, feet, and sanitary area between fuller grooming visits.",
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

export const SERVICES_NAV = [
  { href: "#most-requested", label: "Most Requested" },
  { href: "#bath-coat", label: "Bath & Coat" },
  { href: "#full-groom", label: "Full Groom" },
  { href: "#spa-rituals", label: "Spa Rituals" },
  { href: "#add-ons", label: "Add-Ons" },
  { href: "#color-dye", label: "Color Dye" },
  { href: "#specialty-care", label: "Specialty Care" },
  { href: "#fees-policies", label: "Fees & Policies" },
] as const;

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
  if (service.pricingType === "tiered" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((tier) => tier.priceFrom));
    return `From ${formatPrice(min)}`;
  }
  return "";
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
