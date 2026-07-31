import { business, formatDuration, formatPrice } from "./business";

export type ServiceOption = {
  name: string;
  nameZh?: string;
  priceFrom?: number;
  noteZh?: string;
  consultationRequired?: boolean;
};

export type ServiceTier = {
  weightTier: string;
  priceFrom: number;
  durationMin: number;
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
  seniorAddOn?: boolean;
  priceLabel: string;
  durationLabel?: string;
};

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
      options: "options" in service ? service.options : undefined,
      includes: "includes" in service ? service.includes : undefined,
      bestFor: "bestFor" in service ? service.bestFor : undefined,
      suitableFor: "suitableFor" in service ? service.suitableFor : undefined,
      availableOver45Lbs:
        "availableOver45Lbs" in service ? service.availableOver45Lbs : undefined,
      noBathOver45Lbs:
        "noBathOver45Lbs" in service ? service.noBathOver45Lbs : undefined,
      bookableAsPrimary: service.id !== "senior-comfort-care",
      categoryNote: "note" in category ? category.note : undefined,
      note: "note" in service ? service.note : undefined,
      requiresServiceId:
        "requiresServiceId" in service ? service.requiresServiceId : undefined,
    })),
  );
}

export function isServiceAvailableForPet(serviceId: string, weightLbs: number) {
  if (weightLbs <= business.weightPolicy.maxStandardWeightLbs) {
    return serviceId !== "senior-comfort-care";
  }
  return business.weightPolicy.over45AllowedServiceIds.includes(serviceId);
}

export function unavailableReason(serviceId: string, weightLbs: number) {
  if (weightLbs <= business.weightPolicy.maxStandardWeightLbs) {
    if (serviceId === "senior-comfort-care") {
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
    return `${formatPrice(tier.priceFrom)}+ · ${formatDuration(tier.durationMin, tier.durationMax)}`;
  }

  if (service.pricingType === "hourly" && service.hourlyRate) {
    return `${formatPrice(service.hourlyRate)}/hr · est. ${formatDuration(service.durationMin ?? 90, service.durationMax)}`;
  }

  if (service.pricingType === "add_on") {
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
  return [
    "signature-bath-care",
    "custom-full-haircut",
    "dead-sea-mud-bath",
    "aromatherapy-oil-bath",
    "sensitive-skin-treatment",
  ].includes(serviceId);
}

export function seniorAddOnRange() {
  const service = allBookableServices().find((s) => s.id === "senior-comfort-care");
  return {
    min: service?.addOnMin ?? 30,
    max: service?.addOnMax ?? 50,
  };
}

export function getBookableCategories() {
  return groupServicesByCategory(
    allBookableServices().filter((s) => s.bookableAsPrimary),
  );
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
