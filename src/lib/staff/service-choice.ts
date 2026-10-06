import {
  CREATIVE_ACCENT_COLORING_ID,
  allBookableServices,
  isServiceAvailableForPet,
  type BookableService,
} from "@/lib/services";

const OPTION_SEPARATOR = "::";

export type StaffServiceChoice = {
  value: string;
  serviceId: string;
  optionName: string | null;
  label: string;
  service: BookableService;
};

function choiceForService(
  service: BookableService,
  optionName: string | null,
): StaffServiceChoice | null {
  if (!service.bookableAsPrimary) return null;
  const options =
    service.pricingType === "options" ? (service.options ?? []) : [];
  if (options.length > 0) {
    if (!optionName) return null;
    const option = options.find((entry) => entry.name === optionName);
    if (!option) return null;
    return {
      value: `${service.id}${OPTION_SEPARATOR}${option.name}`,
      serviceId: service.id,
      optionName: option.name,
      label:
        service.id === CREATIVE_ACCENT_COLORING_ID
          ? `Creative coloring-${option.name}`
          : option.name,
      service,
    };
  }
  if (optionName) return null;
  return {
    value: service.id,
    serviceId: service.id,
    optionName: null,
    label: service.name,
    service,
  };
}

/** One menu row per bookable service. Coloring styles are separate rows. */
export function listStaffServiceChoices(weightLbs: number | null) {
  const choices: StaffServiceChoice[] = [];
  for (const service of allBookableServices()) {
    if (weightLbs != null && !isServiceAvailableForPet(service.id, weightLbs)) {
      continue;
    }
    const options =
      service.pricingType === "options" ? (service.options ?? []) : [];
    if (options.length > 0) {
      for (const option of options) {
        const choice = choiceForService(service, option.name);
        if (choice) choices.push(choice);
      }
      continue;
    }
    const choice = choiceForService(service, null);
    if (choice) choices.push(choice);
  }
  return choices;
}

export function parseStaffServiceSelection(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const splitAt = trimmed.indexOf(OPTION_SEPARATOR);
  const serviceId = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const optionName =
    splitAt === -1 ? null : trimmed.slice(splitAt + OPTION_SEPARATOR.length);
  const service = allBookableServices().find((entry) => entry.id === serviceId);
  if (!service) return null;
  return choiceForService(service, optionName);
}
