import { business, formatDuration, formatPrice } from "./business";
import { canonicalServiceId } from "./service-catalog";
import { getServiceDisplayName } from "./service-display";

export type BookingPolicyItem = {
  title: string;
  body: string;
};

export type BookingPolicy = {
  title: string;
  items: BookingPolicyItem[];
};

export type ServiceOption = {
  name: string;
  description?: string;
  priceFrom?: number;
  note?: string;
  consultationRequired?: boolean;
};

export type ServiceTier = {
  weightTier: string;
  priceFrom: number;
  durationMin?: number;
  durationMax?: number;
};

export type CoatTypePrice = {
  weightTier: string;
  coatType: string;
  priceFrom: number;
};

export type BookableService = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  pricingType: string;
  tiers?: ServiceTier[];
  coatTypePrices?: CoatTypePrice[];
  pricingNote?: string;
  coatTypeNote?: string;
  assessmentNote?: string;
  hourlyRate?: number;
  durationMin?: number;
  durationMax?: number;
  durationNote?: string;
  addOnMin?: number;
  addOnMax?: number;
  flatRate?: number;
  policyNote?: string;
  options?: ServiceOption[];
  includes?: string[];
  bestFor?: string;
  suitableFor?: string;
  availableOver45Lbs?: boolean;
  noBathOver45Lbs?: boolean;
  bookableAsPrimary: boolean;
  categoryNote?: string;
  note?: string;
  requiresServiceId?: string;
  membersOnly?: boolean;
  bookingPolicy?: BookingPolicy;
};

export type SelectedService = {
  serviceId: string;
  serviceName: string;
  optionName?: string;
  addOnIds: string[];
  priceLabel: string;
  durationLabel?: string;
};

export const CREATIVE_ACCENT_COLORING_ID = "creative-accent-coloring";

/** No catalog price. Staff enter the amount; guests cannot book it yet. */
export const CUSTOM_CREATIVE_DESIGN_OPTION = "Custom Creative Design";

export const CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE =
  "To confirm the custom design, please contact us first.";

export function isCustomCreativeDesignOption(optionName?: string | null) {
  return optionName?.trim() === CUSTOM_CREATIVE_DESIGN_OPTION;
}

export function isCustomCreativeDesignSelection(
  serviceId: string,
  optionName?: string | null,
) {
  return (
    serviceId === CREATIVE_ACCENT_COLORING_ID &&
    isCustomCreativeDesignOption(optionName)
  );
}

export function parseEnteredServicePrice(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export const CREATIVE_REQUIRED_BASE_IDS = [
  "signature-bath-care",
  "custom-full-haircut",
] as const;

export const SPA_SERVICE_IDS = [
  "luxury-spa-day",
  "dead-sea-mud-bath",
  "aromatherapy-oil-bath",
  "sensitive-skin-treatment",
] as const;

const ADD_ON_ONLY_SERVICE_IDS = [
  "senior-comfort-care",
  "dematting-brush-out",
  "deshedding-treatment",
  "mini-trim",
];

function isAddOnOnlyService(serviceId: string) {
  return ADD_ON_ONLY_SERVICE_IDS.includes(serviceId);
}

export function weightTierForPet(weightLbs: number) {
  if (weightLbs <= 15) return "under15";
  if (weightLbs <= 30) return "15to30";
  if (weightLbs <= 45) return "31to45";
  return "over45";
}

export function weightTierLabel(tierId: string) {
  return business.weightTiers.find((t) => t.id === tierId)?.label ?? tierId;
}

export function allBookableServices(): BookableService[] {
  return business.serviceCategories.flatMap((category) =>
    category.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      categoryId: category.id,
      categoryName: category.name,
      pricingType: service.pricingType,
      tiers: "tiers" in service ? service.tiers : undefined,
      coatTypePrices:
        "coatTypePrices" in service ? service.coatTypePrices : undefined,
      pricingNote: "pricingNote" in service ? service.pricingNote : undefined,
      assessmentNote:
        "assessmentNote" in service
          ? (service.assessmentNote as string | undefined)
          : undefined,
      coatTypeNote: "coatTypeNote" in service ? service.coatTypeNote : undefined,
      hourlyRate: "hourlyRate" in service ? service.hourlyRate : undefined,
      durationMin: "durationMin" in service ? service.durationMin : undefined,
      durationMax: "durationMax" in service ? service.durationMax : undefined,
      durationNote: "durationNote" in service ? service.durationNote : undefined,
      addOnMin: "addOnMin" in service ? service.addOnMin : undefined,
      addOnMax: "addOnMax" in service ? service.addOnMax : undefined,
      flatRate: "flatRate" in service ? service.flatRate : undefined,
      policyNote: "policyNote" in service ? service.policyNote : undefined,
      options: "options" in service ? service.options : undefined,
      includes: "includes" in service ? service.includes : undefined,
      bestFor: "bestFor" in service ? service.bestFor : undefined,
      suitableFor: "suitableFor" in service ? service.suitableFor : undefined,
      availableOver45Lbs:
        "availableOver45Lbs" in service ? service.availableOver45Lbs : undefined,
      noBathOver45Lbs:
        "noBathOver45Lbs" in service ? service.noBathOver45Lbs : undefined,
      bookableAsPrimary: !isAddOnOnlyService(service.id),
      categoryNote: "note" in category ? category.note : undefined,
      note: "note" in service ? service.note : undefined,
      requiresServiceId:
        "requiresServiceId" in service
          ? (service.requiresServiceId as string | undefined)
          : undefined,
      membersOnly:
        "membersOnly" in service ? Boolean(service.membersOnly) : false,
      bookingPolicy:
        "bookingPolicy" in service
          ? (service.bookingPolicy as BookingPolicy)
          : undefined,
    })),
  ) as BookableService[];
}

export function isServiceAvailableForPet(serviceId: string, weightLbs: number) {
  if (weightLbs <= business.weightPolicy.maxStandardWeightLbs) {
    return !isAddOnOnlyService(serviceId);
  }
  return business.weightPolicy.over45AllowedServiceIds.includes(serviceId);
}

export function unavailableReason(serviceId: string, weightLbs: number) {
  if (weightLbs <= business.weightPolicy.maxStandardWeightLbs) {
    if (isAddOnOnlyService(serviceId)) {
      return "Add-on only — select a bath or grooming service first.";
    }
    return null;
  }
  if (!business.weightPolicy.over45AllowedServiceIds.includes(serviceId)) {
    return business.weightPolicy.over45Note;
  }
  const service = allBookableServices().find((s) => s.id === serviceId);
  if (service?.noBathOver45Lbs) {
    return "Available without bath services for dogs over 45 lbs.";
  }
  return null;
}

export function getTierForPet(
  service: BookableService,
  weightLbs: number,
): ServiceTier | null {
  if (!service.tiers || weightLbs > business.weightPolicy.maxStandardWeightLbs) {
    return null;
  }
  const tierId = weightTierForPet(weightLbs);
  return service.tiers.find((t) => t.weightTier === tierId) ?? null;
}

export function coatTypeLabel(coatTypeId: string) {
  return business.coatTypes.find((item) => item.id === coatTypeId)?.label ?? coatTypeId;
}

export function hasCoatTypePricing(service: BookableService) {
  return Boolean(service.coatTypePrices?.length);
}

/**
 * Full Groom (and any coat-priced service) lookup.
 * When coatType is omitted, returns the starting (lowest) price for that weight.
 * Does not infer coat type from breed or default to Medium / Standard.
 */
export function getCoatTypePriceForPet(
  service: BookableService,
  weightLbs: number,
  coatType?: string | null,
): number | null {
  if (
    !service.coatTypePrices?.length ||
    weightLbs > business.weightPolicy.maxStandardWeightLbs
  ) {
    return null;
  }
  const tierId = weightTierForPet(weightLbs);
  const forWeight = service.coatTypePrices.filter(
    (entry) => entry.weightTier === tierId,
  );
  if (!forWeight.length) return null;
  if (coatType) {
    return (
      forWeight.find((entry) => entry.coatType === coatType)?.priceFrom ?? null
    );
  }
  return Math.min(...forWeight.map((entry) => entry.priceFrom));
}

export function formatServicePrice(
  service: BookableService,
  weightLbs: number,
  optionName?: string,
) {
  if (isAssessedOnSiteService(service)) return "";
  if (service.pricingType === "tiered") {
    const coatPrice = hasCoatTypePricing(service)
      ? getCoatTypePriceForPet(service, weightLbs)
      : null;
    const tier = getTierForPet(service, weightLbs);
    const priceFrom = coatPrice ?? tier?.priceFrom;
    if (priceFrom == null) return "Not available for this weight";
    return `From ${formatPrice(priceFrom)} · ${formatDuration(tier?.durationMin ?? 0, tier?.durationMax)}`;
  }

  if (service.pricingType === "hourly" && service.hourlyRate) {
    return `${formatPrice(service.hourlyRate)}/hr · est. ${formatDuration(service.durationMin ?? 90, service.durationMax)}`;
  }

  if (service.pricingType === "add_on") {
    if (service.options?.length) {
      const option =
        service.options.find((o) => o.name === optionName) ?? service.options[0];
      if (option?.consultationRequired) return "Consultation required add-on";
      if (option?.priceFrom != null) {
        return `From ${formatPrice(option.priceFrom)} · ${option.name}`;
      }
      return "From $50 add-on";
    }
    if (service.tiers?.length) {
      const tier = getTierForPet(service, weightLbs);
      if (!tier) return "Not available for this weight";
      return `From ${formatPrice(tier.priceFrom)} add-on`;
    }
    if (service.flatRate != null) {
      if (service.durationMin != null) {
        return `From ${formatPrice(service.flatRate)} / ${service.durationMin} mins add-on`;
      }
      return `From ${formatPrice(service.flatRate)} add-on`;
    }
    return `From ${formatPrice(service.addOnMin ?? 0)} add-on`;
  }

  if (service.pricingType === "options" && service.options) {
    const option =
      service.options.find((o) => o.name === optionName) ?? service.options[0];
    if (option?.consultationRequired) return "Consultation required";
    if (option?.priceFrom != null) {
      return `From ${formatPrice(option.priceFrom)} · ${option.name}`;
    }
    return "From $50";
  }

  if (service.pricingType === "consultation") {
    return "Contact us for pricing";
  }

  if (service.pricingType === "free") {
    return "Complimentary · By appointment only";
  }

  return "";
}

export const GENTLE_DEMATTING_ID = "dematting-brush-out";
export const DESHEDDING_ADD_ON_ID = "deshedding-treatment";
export const SENIOR_CARE_ADD_ON_ID = "senior-comfort-care";

export const GENTLE_DEMATTING_DESCRIPTION =
  "Gentle removal of light to moderate tangles, with your dog's comfort and coat health as the priority.";

export const GENTLE_DEMATTING_ASSESSMENT_NOTE =
  "Pricing will be assessed by your groomer on-site, based on your dog's coat condition.";

export const GENTLE_DEMATTING_EXCLUSION_NOTE =
  "Excludes the on-site assessment fee for Gentle DeMatting.";

/**
 * Staff billing floor for Gentle DeMatting. Not a guest price and not an
 * automatic charge. Extra time is quoted by the groomer before it is collected.
 */
export const GENTLE_DEMATTING_INTERNAL_START = {
  minutes: 15,
  amount: 30,
} as const;

const SCHEDULE_NEUTRAL_ADD_ON_IDS = new Set([
  GENTLE_DEMATTING_ID,
  DESHEDDING_ADD_ON_ID,
  SENIOR_CARE_ADD_ON_ID,
  "mini-trim",
]);

export function isAssessedOnSiteService(service: {
  id: string;
  pricingType?: string;
}) {
  return (
    canonicalServiceId(service.id) === GENTLE_DEMATTING_ID ||
    service.pricingType === "assessed"
  );
}

export type AddOnAvailability = "selectable" | "included" | "unavailable";

const ADD_ON_MATRIX: Record<string, Record<string, AddOnAvailability>> = {
  "signature-bath-care": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "selectable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    "mini-trim": "selectable",
  },
  "show-level-coat-care": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "selectable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    "mini-trim": "included",
  },
  "luxury-spa-day": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "included",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    "mini-trim": "included",
  },
  "custom-full-haircut": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "selectable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    "mini-trim": "included",
  },
  "hand-stripping": {
    [GENTLE_DEMATTING_ID]: "selectable",
    [DESHEDDING_ADD_ON_ID]: "unavailable",
    [SENIOR_CARE_ADD_ON_ID]: "selectable",
    "mini-trim": "unavailable",
  },
};

export function addOnAvailability(
  primaryServiceId: string,
  addOnId: string,
): AddOnAvailability {
  const primary = canonicalServiceId(primaryServiceId);
  const addOn = canonicalServiceId(addOnId);
  if (primary === "end-of-life-care") return "unavailable";
  if (addOn === CREATIVE_ACCENT_COLORING_ID) {
    return supportsCreativeColoringAddOn(primary) ? "selectable" : "unavailable";
  }
  return ADD_ON_MATRIX[primary]?.[addOn] ?? "unavailable";
}

export function supportsSeniorAddOn(serviceId: string) {
  return addOnAvailability(serviceId, SENIOR_CARE_ADD_ON_ID) === "selectable";
}

export const MINI_TRIM_ADD_ON_ID = "mini-trim";

export const MINI_TRIM_ALREADY_INCLUDED_MESSAGE =
  "Mini Trim is already included with this grooming service. Extra trimming is added only as a separate confirmed adjustment, not by charging Mini Trim again.";

/** Show-Level Coat Care, Luxury Spa Day, and the full groom already include Mini Trim. */
export function serviceIncludesMiniTrim(serviceId: string) {
  const id = canonicalServiceId(serviceId);
  return (
    id === "show-level-coat-care" ||
    id === "luxury-spa-day" ||
    id === "custom-full-haircut"
  );
}

export function selectionRepeatsIncludedMiniTrim(
  serviceIds: readonly string[],
  addOnIds: readonly string[] = [],
) {
  const services = serviceIds.map((id) => canonicalServiceId(id));
  const addOns = addOnIds.map((id) => canonicalServiceId(id));
  const included = services.some((id) => serviceIncludesMiniTrim(id));
  const chargesMiniTrim =
    services.includes(MINI_TRIM_ADD_ON_ID) ||
    addOns.includes(MINI_TRIM_ADD_ON_ID);
  return included && chargesMiniTrim;
}

export function supportsMiniTrimAddOn(serviceId: string) {
  return addOnAvailability(serviceId, MINI_TRIM_ADD_ON_ID) === "selectable";
}

export function serviceIncludesDeShedding(serviceId: string) {
  return (
    addOnAvailability(serviceId, DESHEDDING_ADD_ON_ID) === "included"
  );
}

const KNOWN_ADD_ON_IDS = new Set<string>([
  GENTLE_DEMATTING_ID,
  DESHEDDING_ADD_ON_ID,
  SENIOR_CARE_ADD_ON_ID,
  MINI_TRIM_ADD_ON_ID,
  CREATIVE_ACCENT_COLORING_ID,
]);

export function isCatalogAddOnId(id: string) {
  return KNOWN_ADD_ON_IDS.has(canonicalServiceId(id));
}

export const DESHEDDING_ALREADY_INCLUDED_MESSAGE =
  "DeShedding Care is already included with Luxury Spa Day.";

/** Rejects included, unavailable, and duplicated add-ons for staff and guests. */
export function addOnSelectionMessage(
  serviceIds: readonly string[],
  addOnIds: readonly string[] = [],
) {
  const services = serviceIds.map((id) => canonicalServiceId(id));
  const extras = [
    ...services.filter((id) => KNOWN_ADD_ON_IDS.has(id)),
    ...addOnIds.map((id) => canonicalServiceId(id)),
  ];
  const pricedExtras = extras.filter((id) => id !== CREATIVE_ACCENT_COLORING_ID);
  if (new Set(pricedExtras).size !== pricedExtras.length) {
    return "That add-on cannot be booked with this service.";
  }
  const uniqueExtras = [...new Set(extras)];
  const primaries = services.filter((id) => !KNOWN_ADD_ON_IDS.has(id));
  for (const primary of primaries) {
    for (const extra of uniqueExtras) {
      const availability = addOnAvailability(primary, extra);
      if (availability === "selectable") continue;
      if (availability === "included" && extra === MINI_TRIM_ADD_ON_ID) {
        return MINI_TRIM_ALREADY_INCLUDED_MESSAGE;
      }
      if (availability === "included" && extra === DESHEDDING_ADD_ON_ID) {
        return DESHEDDING_ALREADY_INCLUDED_MESSAGE;
      }
      if (availability === "included") {
        return "That add-on is already included with this service.";
      }
      return "That add-on cannot be booked with this service.";
    }
  }
  return null;
}

export function supportsCreativeColoringAddOn(serviceId: string) {
  return CREATIVE_REQUIRED_BASE_IDS.includes(
    serviceId as (typeof CREATIVE_REQUIRED_BASE_IDS)[number],
  );
}

export function getCreativeColoringService() {
  return allBookableServices().find((s) => s.id === CREATIVE_ACCENT_COLORING_ID);
}

export function getCreativeBookingPolicy() {
  return getCreativeColoringService()?.bookingPolicy;
}

export function formatCreativeBookingPolicyForEmail(policy: BookingPolicy) {
  const lines = [
    "",
    policy.title,
    "",
    ...policy.items.flatMap((item, index) => [
      `${index + 1}. ${item.title}`,
      item.body,
      "",
    ]),
  ];
  return lines.join("\n").trimEnd();
}

export function bookingIncludesCreativeColoring(addOnIds: string[]) {
  return addOnIds.includes(CREATIVE_ACCENT_COLORING_ID);
}

export function getRequiredBaseServicesForCreative() {
  return CREATIVE_REQUIRED_BASE_IDS.map((id) =>
    allBookableServices().find((s) => s.id === id),
  ).filter((s): s is BookableService => s != null);
}

export function isSpaService(serviceId: string) {
  return (SPA_SERVICE_IDS as readonly string[]).includes(
    canonicalServiceId(serviceId),
  );
}

export function retiredCatalogServices(): BookableService[] {
  return business.retiredServices.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    categoryId: "retired",
    categoryName: "Retired",
    pricingType: service.pricingType,
    tiers: service.tiers,
    bookableAsPrimary: false,
  }));
}

/** Bookable catalog first, then retired care plans. Aliases share one service. */
export function findCatalogService(serviceId: string) {
  const id = canonicalServiceId(serviceId);
  return (
    allBookableServices().find((service) => service.id === id) ??
    retiredCatalogServices().find((service) => service.id === id) ??
    null
  );
}

export function isCreativeColoringCategory(categoryId: string) {
  return categoryId === CREATIVE_ACCENT_COLORING_ID;
}

export function seniorAddOnRange() {
  const service = allBookableServices().find((s) => s.id === "senior-comfort-care");
  const fees = service?.tiers?.map((t) => t.priceFrom) ?? [30, 40, 50];
  return {
    min: Math.min(...fees),
    max: Math.max(...fees),
  };
}

export function getSeniorAddOnFee(weightLbs: number) {
  const service = allBookableServices().find((s) => s.id === "senior-comfort-care");
  if (!service?.tiers) return null;
  const tier = getTierForPet(service, weightLbs);
  return tier?.priceFrom ?? null;
}

export function getBookableCategories(
  options: { includeMembersOnly?: boolean } = {},
) {
  return groupServicesByCategory(
    allBookableServices().filter((s) => {
      if (!s.bookableAsPrimary) return false;
      if (s.membersOnly && !options.includeMembersOnly) return false;
      return true;
    }),
  );
}

export function getCategoryAddOnServices(categoryId: string) {
  return allBookableServices().filter(
    (s) => s.categoryId === categoryId && !s.bookableAsPrimary,
  );
}

export function getAvailableAddOns(
  _categoryId: string,
  primaryServiceId: string,
) {
  const primary = canonicalServiceId(primaryServiceId);
  const addOns = allBookableServices().filter(
    (service) =>
      !service.bookableAsPrimary &&
      addOnAvailability(primary, service.id) === "selectable",
  );

  if (addOnAvailability(primary, CREATIVE_ACCENT_COLORING_ID) !== "selectable") {
    return addOns;
  }

  const creative = getCreativeColoringService();
  if (creative && !addOns.some((item) => item.id === creative.id)) {
    return [...addOns, creative];
  }
  return addOns;
}

export function getAddOnService(id: string) {
  return allBookableServices().find((s) => s.id === canonicalServiceId(id));
}

export type ResolvedAddOnCharge =
  | { id: string; name: string; kind: "priced"; amount: number }
  | { id: string; name: string; kind: "assessed"; note: string }
  | { id: string; name: string; kind: "unpriced" };

function catalogAddOnAmount(
  addOn: BookableService,
  weightLbs: number,
  optionName?: string,
) {
  if (addOn.options?.length) {
    const option = addOn.options.find((item) => item.name === optionName);
    if (!option || option.priceFrom == null) return null;
    return option.priceFrom;
  }
  return getServicePriceEstimate(addOn, weightLbs, optionName)?.from ?? null;
}

/**
 * Priced add-ons keep their catalog amount. Gentle DeMatting stays assessed
 * and is never turned into $0. Included, unavailable, and duplicate ids drop out.
 */
export function resolveAddOnCharges(
  primaryServiceId: string,
  addOnIds: readonly string[],
  weightLbs: number,
  addOnOptions: Record<string, string> = {},
): ResolvedAddOnCharge[] {
  const seen = new Set<string>();
  const charges: ResolvedAddOnCharge[] = [];
  for (const rawId of addOnIds) {
    const id = canonicalServiceId(rawId);
    if (seen.has(id)) continue;
    seen.add(id);
    if (addOnAvailability(primaryServiceId, id) !== "selectable") continue;
    const addOn = getAddOnService(id);
    if (!addOn) continue;
    const name = getServiceDisplayName(addOn.id, addOn.name);
    if (isAssessedOnSiteService(addOn)) {
      charges.push({
        id,
        name,
        kind: "assessed",
        note: addOn.assessmentNote?.trim() || GENTLE_DEMATTING_ASSESSMENT_NOTE,
      });
      continue;
    }
    const amount = catalogAddOnAmount(addOn, weightLbs, addOnOptions[id]);
    if (amount == null) {
      charges.push({ id, name, kind: "unpriced" });
      continue;
    }
    charges.push({ id, name, kind: "priced", amount });
  }
  return charges;
}

/** Minutes blocked on the van for a primary service plus selected add-ons. */
export function estimateServiceDurationMinutes(
  serviceId: string,
  weightLbs: number,
  addOnIds: string[] = [],
) {
  const service = findCatalogService(serviceId);
  const tier = service ? getTierForPet(service, weightLbs) : null;
  const min =
    tier?.durationMin ?? service?.durationMin ?? service?.durationMax ?? 60;
  const max =
    tier?.durationMax ?? service?.durationMax ?? tier?.durationMin ?? service?.durationMin ?? min;
  let minutes = Math.round((min + max) / 2);

  for (const addOnId of addOnIds) {
    if (SCHEDULE_NEUTRAL_ADD_ON_IDS.has(canonicalServiceId(addOnId))) continue;
    const addOn = getAddOnService(addOnId);
    if (!addOn) continue;
    const addOnTier = getTierForPet(addOn, weightLbs);
    const addOnMin =
      addOnTier?.durationMin ?? addOn.durationMin ?? addOn.durationMax ?? 0;
    const addOnMax =
      addOnTier?.durationMax ?? addOn.durationMax ?? addOn.durationMin ?? addOnMin;
    minutes += Math.round((addOnMin + addOnMax) / 2);
  }

  return Math.max(30, minutes);
}

export function formatServicePriceFrom(service: BookableService) {
  if (isAssessedOnSiteService(service)) return "";
  if (service.pricingType === "tiered" && service.coatTypePrices?.length) {
    const min = Math.min(...service.coatTypePrices.map((t) => t.priceFrom));
    return `From ${formatPrice(min)}`;
  }
  if (service.pricingType === "tiered" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((t) => t.priceFrom));
    return `From ${formatPrice(min)}`;
  }
  if (service.pricingType === "hourly" && service.hourlyRate) {
    return `${formatPrice(service.hourlyRate)}/hr`;
  }
  if (service.pricingType === "options" && service.options?.length) {
    const priced = service.options.filter((o) => o.priceFrom != null);
    if (priced.length) {
      const min = Math.min(...priced.map((o) => o.priceFrom!));
      return `From ${formatPrice(min)}`;
    }
    return "Consultation required";
  }
  if (service.pricingType === "consultation") {
    return "By consultation";
  }
  if (service.pricingType === "free") {
    return "Complimentary";
  }
  if (service.pricingType === "add_on" && service.options?.length) {
    const priced = service.options.filter((o) => o.priceFrom != null);
    if (priced.length) {
      const min = Math.min(...priced.map((o) => o.priceFrom!));
      return `From ${formatPrice(min)} (Add-on)`;
    }
    return "Consultation required (Add-on)";
  }
  if (service.pricingType === "add_on" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((t) => t.priceFrom));
    return `From ${formatPrice(min)} (Add-on)`;
  }
  if (service.pricingType === "add_on" && service.flatRate != null) {
    if (service.durationMin != null) {
      return `From ${formatPrice(service.flatRate)} / ${service.durationMin} mins (Add-on)`;
    }
    return `From ${formatPrice(service.flatRate)} (Add-on)`;
  }
  return "";
}

export function getServicePriceEstimate(
  service: BookableService,
  weightLbs: number,
  optionName?: string,
  coatType?: string | null,
) {
  if (isAssessedOnSiteService(service)) return null;
  if (canonicalServiceId(service.id) === MINI_TRIM_ADD_ON_ID) {
    return { from: service.flatRate ?? 30, durationLabel: undefined };
  }
  if (service.pricingType === "tiered") {
    const tier = getTierForPet(service, weightLbs);
    if (hasCoatTypePricing(service)) {
      const from = getCoatTypePriceForPet(service, weightLbs, coatType);
      if (from == null) return null;
      return {
        from,
        durationLabel: tier
          ? formatDuration(tier.durationMin ?? 0, tier.durationMax)
          : undefined,
      };
    }
    if (!tier) return null;
    return {
      from: tier.priceFrom,
      durationLabel: formatDuration(tier.durationMin ?? 0, tier.durationMax),
    };
  }
  if (service.pricingType === "hourly" && service.hourlyRate) {
    return {
      from: service.hourlyRate,
      durationLabel: formatDuration(
        service.durationMin ?? 90,
        service.durationMax,
      ),
    };
  }
  if (service.pricingType === "add_on") {
    if (service.tiers?.length) {
      const tier = getTierForPet(service, weightLbs);
      if (!tier) return null;
      return { from: tier.priceFrom, durationLabel: undefined };
    }
    if (service.flatRate != null) {
      return {
        from: service.flatRate,
        durationLabel:
          service.durationMin != null ? `${service.durationMin} min` : undefined,
      };
    }
    if (service.options?.length) {
      const option =
        service.options.find((o) => o.name === optionName) ?? service.options[0];
      if (option?.priceFrom != null) {
        return { from: option.priceFrom, durationLabel: undefined };
      }
    }
    return service.addOnMin != null
      ? { from: service.addOnMin, durationLabel: undefined }
      : null;
  }
  if (service.pricingType === "free") {
    return { from: 0, durationLabel: undefined };
  }
  if (service.pricingType === "options" && service.options?.length) {
    const option = service.options.find((entry) => entry.name === optionName);
    if (option?.priceFrom == null) return null;
    return { from: option.priceFrom, durationLabel: undefined };
  }
  return null;
}

/** Catalog price, or the amount staff typed for Custom Creative Design. */
export function bookedServiceAmount(
  service: BookableService,
  weightLbs: number,
  optionName?: string | null,
  enteredPrice?: number | null,
) {
  if (isCustomCreativeDesignSelection(service.id, optionName)) {
    return parseEnteredServicePrice(enteredPrice);
  }
  return (
    getServicePriceEstimate(service, weightLbs, optionName ?? undefined)?.from ??
    null
  );
}

export function getBookableServicesForPet(
  weightLbs: number,
  options: { includeMembersOnly?: boolean } = {},
) {
  return allBookableServices().filter((service) => {
    if (!service.bookableAsPrimary) return false;
    if (service.membersOnly && !options.includeMembersOnly) return false;
    return isServiceAvailableForPet(service.id, weightLbs);
  });
}

export function groupServicesByCategory(services: BookableService[]) {
  const groups = new Map<
    string,
    { name: string; note?: string; services: BookableService[] }
  >();

  for (const service of services) {
    const existing = groups.get(service.categoryId);
    if (existing) {
      existing.services.push(service);
    } else {
      groups.set(service.categoryId, {
        name: service.categoryName,
        note: service.categoryNote,
        services: [service],
      });
    }
  }

  const categoryOrder = business.serviceCategories.map((c) => c.id);

  return categoryOrder
    .filter((id) => groups.has(id))
    .map((id) => {
      const group = groups.get(id)!;
      return { id, ...group };
    });
}
