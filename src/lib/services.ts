import { business, formatDuration, formatPrice } from "./business";

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

export const CREATIVE_REQUIRED_BASE_IDS = [
  "signature-bath-care",
  "custom-full-haircut",
] as const;

export const SPA_SERVICE_IDS = [
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

export function formatServicePrice(
  service: BookableService,
  weightLbs: number,
  optionName?: string,
) {
  if (service.pricingType === "tiered") {
    const tier = getTierForPet(service, weightLbs);
    if (!tier) return "Not available for this weight";
    return `From ${formatPrice(tier.priceFrom)} · ${formatDuration(tier.durationMin ?? 0, tier.durationMax)}`;
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

export function supportsSeniorAddOn(serviceId: string) {
  if (serviceId === "hand-stripping") return false;
  return [
    "signature-bath-care",
    "custom-full-haircut",
    "long-coat-show-care",
    "dead-sea-mud-bath",
    "aromatherapy-oil-bath",
    "sensitive-skin-treatment",
  ].includes(serviceId);
}

export function supportsMiniTrimAddOn(serviceId: string) {
  if (serviceId === "custom-full-haircut" || isSpaService(serviceId)) {
    return false;
  }
  if (serviceId === "hand-stripping" || serviceId === "end-of-life-care") {
    return false;
  }
  return true;
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
  return (SPA_SERVICE_IDS as readonly string[]).includes(serviceId);
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
  const addOns = allBookableServices().filter((service) => !service.bookableAsPrimary);

  const filtered = addOns.filter((addOn) => {
    if (primaryServiceId === "end-of-life-care") return false;
    if (primaryServiceId === "hand-stripping") {
      return addOn.id === "dematting-brush-out";
    }
    if (addOn.id === "senior-comfort-care") {
      return supportsSeniorAddOn(primaryServiceId);
    }
    if (addOn.id === "mini-trim") {
      return supportsMiniTrimAddOn(primaryServiceId);
    }
    return true;
  });

  let result = filtered;

  if (supportsCreativeColoringAddOn(primaryServiceId)) {
    const creative = getCreativeColoringService();
    if (creative && !result.some((item) => item.id === creative.id)) {
      result = [...result, creative];
    }
  }

  return result;
}

export function getAddOnService(id: string) {
  return allBookableServices().find((s) => s.id === id);
}

/** Minutes blocked on the van for a primary service plus selected add-ons. */
export function estimateServiceDurationMinutes(
  serviceId: string,
  weightLbs: number,
  addOnIds: string[] = [],
) {
  const service = allBookableServices().find((item) => item.id === serviceId);
  const tier = service ? getTierForPet(service, weightLbs) : null;
  let minutes =
    tier?.durationMin ?? service?.durationMin ?? service?.durationMax ?? 60;

  for (const addOnId of addOnIds) {
    const addOn = getAddOnService(addOnId);
    if (!addOn) continue;
    const addOnTier = getTierForPet(addOn, weightLbs);
    minutes += addOnTier?.durationMin ?? addOn.durationMin ?? 0;
  }

  return Math.max(30, minutes);
}

export function formatServicePriceFrom(service: BookableService) {
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
) {
  if (service.pricingType === "tiered") {
    const tier = getTierForPet(service, weightLbs);
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
  return null;
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
