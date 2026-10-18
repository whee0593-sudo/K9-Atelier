import type { BookableService, ServiceTier } from "@/lib/services";

const CARD_SUMMARIES: Record<string, string> = {
  "signature-bath-care":
    "Bath, blow-dry, and brush-out. Nail, ear, and teeth care included.",
  "custom-full-haircut":
    "A complete grooming experience finished with a custom haircut tailored to coat, lifestyle, and expression.",
  "show-level-coat-care":
    "An upgraded bath with show-level coat conditioning. Nail, ear, and teeth care included. Mini trim included.",
  "long-coat-show-care":
    "An upgraded bath with show-level coat conditioning. Nail, ear, and teeth care included. Mini trim included.",
  "hand-stripping":
    "Traditional hand stripping for wire-coated breeds, preserving harsh texture, color, and natural coat protection.",
  "luxury-spa-day":
    "A fully customized, relaxing spa experience for your pup. Nail, ear, and teeth care included. Mini trim included.",
  "dematting-brush-out":
    "Gentle removal of light to moderate tangles, with your dog's comfort and coat health as the priority.",
  "deshedding-treatment":
    "A deep undercoat treatment to release trapped hair and reduce shedding after the bath.",
  "senior-comfort-care":
    "Extra-gentle, comfort-focused care for senior dogs who benefit from a slower pace, additional breaks and patient handling.",
  "mini-trim": "Eyes, feet & sanitary areas only.",
  "creative-accent-coloring":
    "Pet-safe, semi-permanent accent color designed specifically for animal coats.",
  "end-of-life-care":
    "Compassionate comfort grooming for dogs in the final chapter of life, focused on gentle handling, dignity and minimizing unnecessary stress.",
};

const CARD_BEST_FOR: Record<string, string> = {
  "signature-bath-care": "Regular coat maintenance",
  "custom-full-haircut": "A complete haircut and style",
  "show-level-coat-care": "Full-coat breeds on a weekly schedule",
  "long-coat-show-care": "Full-coat breeds on a weekly schedule",
  "luxury-spa-day": "A relaxing spa day",
  "hand-stripping": "Wire-coated breeds",
  "dematting-brush-out": "Light to moderate tangles",
  "deshedding-treatment": "Heavy-shedding double coats",
  "senior-comfort-care": "Senior dogs who need a slower, gentler grooming experience.",
  "mini-trim": "Quick tidy between full grooms",
  "creative-accent-coloring": "A playful, pet-safe pop of color",
  "end-of-life-care": "Comfort-first visits in a dog’s final chapter",
};

function formatDuration(min: number, max?: number) {
  if (max && max !== min) return `${min}–${max} min`;
  return `${min} min`;
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

export function serviceCardSummary(service: BookableService) {
  return CARD_SUMMARIES[service.id] ?? firstSentences(service.description, 35);
}

export function serviceCardBestFor(service: BookableService) {
  return CARD_BEST_FOR[service.id] ?? shortenBestFor(service.bestFor);
}

export function serviceCardAccessLabel(service: BookableService) {
  if (service.membersOnly) return "Members only";
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
