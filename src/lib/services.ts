import { business, formatDuration, formatPrice } from "./business";

export type ServiceOption = {
  name: string;
  nameZh?: string;
  description?: string;
  priceFrom?: number;
  note?: string;
  noteZh?: string;
  consultationRequired?: boolean;
};

export type ServiceTier = {
  weightTier: string;
  priceFrom: number;
  durationMin?: number;
  durationMax?: number;
};

export type BookableService = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  pricingType: string;
  tiers?: ServiceTier[];
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

export const CREATIVE_REQUIRED_BASE_IDS = [
  "signature-bath-care",
  "custom-full-haircut",
] as const;

const ADD_ON_ONLY_SERVICE_IDS = [
  "senior-comfort-care",
  "dematting-brush-out",
  "deshedding-treatment",
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

export function formatServicePrice(
  service: BookableService,
  weightLbs: number,
  optionName?: string,
) {
  if (service.pricingType === "tiered") {
    const tier = getTierForPet(service, weightLbs);
    if (!tier) return "Not available for this weight";
    return `${formatPrice(tier.priceFrom)}+ · ${formatDuration(tier.durationMin ?? 0, tier.durationMax)}`;
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
        return `+${formatPrice(option.priceFrom)}+ · ${option.name}`;
      }
      return "From $50+ add-on";
    }
    if (service.tiers?.length) {
      const tier = getTierForPet(service, weightLbs);
      if (!tier) return "Not available for this weight";
      return `+${formatPrice(tier.priceFrom)} add-on`;
    }
    if (service.flatRate != null) {
      const mins = service.durationMin ?? 15;
      return `+${formatPrice(service.flatRate)} / ${mins} mins add-on`;
    }
    const max = service.addOnMax ?? service.addOnMin ?? 0;
    return `+${formatPrice(service.addOnMin ?? 0)}–${formatPrice(max)} add-on`;
  }

  if (service.pricingType === "options" && service.options) {
    const option =
      service.options.find((o) => o.name === optionName) ?? service.options[0];
    if (option?.consultationRequired) return "Consultation required";
    if (option?.priceFrom != null) {
      return `${formatPrice(option.priceFrom)}+ · ${option.name}`;
    }
    return "From $50+";
  }

  if (service.pricingType === "consultation") {
    return "Contact us for pricing";
  }

  if (service.pricingType === "free") {
    return "Complimentary · By appointment only";
  }

  return "";
}

export function supportsSeniorAddOn(serviceId: string) {
  if (serviceId === "hand-stripping") return false;
  return [
    "signature-bath-care",
    "custom-full-haircut",
    "dead-sea-mud-bath",
    "aromatherapy-oil-bath",
    "sensitive-skin-treatment",
  ].includes(serviceId);
}

export function supportsCreativeColoringAddOn(serviceId: string) {
  return CREATIVE_REQUIRED_BASE_IDS.includes(
    serviceId as (typeof CREATIVE_REQUIRED_BASE_IDS)[number],
  );
}

export function getCreativeColoringService() {
  return allBookableServices().find((s) => s.id === CREATIVE_ACCENT_COLORING_ID);
}

export function getRequiredBaseServicesForCreative() {
  return CREATIVE_REQUIRED_BASE_IDS.map((id) =>
    allBookableServices().find((s) => s.id === id),
  ).filter((s): s is BookableService => s != null);
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

export function getBookableCategories() {
  return groupServicesByCategory(
    allBookableServices().filter((s) => s.bookableAsPrimary),
  );
}

export function getCategoryAddOnServices(categoryId: string) {
  return allBookableServices().filter(
    (s) => s.categoryId === categoryId && !s.bookableAsPrimary,
  );
}

export function getAvailableAddOns(
  categoryId: string,
  primaryServiceId: string,
) {
  const categoryAddOns = getCategoryAddOnServices(categoryId).filter(
    (addOn) => {
      if (primaryServiceId === "hand-stripping") {
        return addOn.id === "dematting-brush-out";
      }
      if (addOn.id === "senior-comfort-care") {
        return supportsSeniorAddOn(primaryServiceId);
      }
      return true;
    },
  );

  let addOns = categoryAddOns;

  if (supportsCreativeColoringAddOn(primaryServiceId)) {
    const creative = getCreativeColoringService();
    if (creative && !addOns.some((a) => a.id === creative.id)) {
      addOns = [...addOns, creative];
    }
  }

  if (addOns.length > 0) return addOns;

  if (supportsSeniorAddOn(primaryServiceId)) {
    const senior = allBookableServices().find(
      (s) => s.id === "senior-comfort-care",
    );
    return senior ? [senior] : [];
  }

  return [];
}

export function getAddOnService(id: string) {
  return allBookableServices().find((s) => s.id === id);
}

export function formatServicePriceFrom(service: BookableService) {
  if (service.pricingType === "tiered" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((t) => t.priceFrom));
    return `From ${formatPrice(min)}+`;
  }
  if (service.pricingType === "hourly" && service.hourlyRate) {
    return `${formatPrice(service.hourlyRate)}/hr`;
  }
  if (service.pricingType === "options" && service.options?.length) {
    const priced = service.options.filter((o) => o.priceFrom != null);
    if (priced.length) {
      const min = Math.min(...priced.map((o) => o.priceFrom!));
      return `From ${formatPrice(min)}+`;
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
      return `From ${formatPrice(min)}+ (Add-on)`;
    }
    return "Consultation required (Add-on)";
  }
  if (service.pricingType === "add_on" && service.tiers?.length) {
    const min = Math.min(...service.tiers.map((t) => t.priceFrom));
    const max = Math.max(...service.tiers.map((t) => t.priceFrom));
    return min === max
      ? `+${formatPrice(min)} (Add-on)`
      : `${formatPrice(min)} – ${formatPrice(max)} (Add-on)`;
  }
  if (service.pricingType === "add_on" && service.flatRate != null) {
    const mins = service.durationMin ?? 15;
    return `${formatPrice(service.flatRate)} / ${mins} mins (Add-on)`;
  }
  return "";
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
