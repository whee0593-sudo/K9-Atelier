import { business } from "@/lib/business";
import {
  CREATIVE_ACCENT_COLORING_ID,
  allBookableServices,
  type BookableService,
} from "@/lib/services";

const OPTION_SEPARATOR = "::";

const STAFF_MENU_PREFIX: Record<string, string> = {
  "dead-sea-mud-bath": "SPA/",
  "aromatherapy-oil-bath": "SPA/",
  "sensitive-skin-treatment": "SPA/",
  "senior-comfort-care": "Specialty care/",
  "end-of-life-care": "Specialty care/",
  "dematting-brush-out": "Add-on care/",
  "deshedding-treatment": "Add-on care/",
  "mini-trim": "Add-on care/",
};

const STAFF_MENU_CHILD_NAME: Record<string, string> = {
  "senior-comfort-care": "Extra-gentle senior care",
  "dematting-brush-out": "Dematting & gentle brush-out",
};

export function staffMenuAllows(serviceId: string, weightLbs: number) {
  if (weightLbs <= business.weightPolicy.maxStandardWeightLbs) return true;
  return business.weightPolicy.over45AllowedServiceIds.includes(serviceId);
}

function staffMenuLabel(service: BookableService) {
  const prefix = STAFF_MENU_PREFIX[service.id];
  if (!prefix) return service.name;
  return `${prefix}${STAFF_MENU_CHILD_NAME[service.id] ?? service.name}`;
}

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
  const grouped = service.id in STAFF_MENU_PREFIX;
  if (!service.bookableAsPrimary && !grouped) return null;
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
          ? `Creative coloring/${option.name}`
          : option.name,
      service,
    };
  }
  if (optionName) return null;
  return {
    value: service.id,
    serviceId: service.id,
    optionName: null,
    label: staffMenuLabel(service),
    service,
  };
}

/** One menu row per bookable service. Coloring styles are separate rows. */
export function listStaffServiceChoices(weightLbs: number | null) {
  const choices: StaffServiceChoice[] = [];
  for (const service of allBookableServices()) {
    if (weightLbs != null && !staffMenuAllows(service.id, weightLbs)) {
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
