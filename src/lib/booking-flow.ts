import {
  estimateServiceDurationMinutes,
  getBookableServicesForPet,
  groupServicesByCategory,
  isCreativeColoringCategory,
  isSpaService,
  type BookableService,
} from "@/lib/services";
import { coloringOptionPriceLabel } from "@/lib/service-page";
import type { PetProfile } from "@/lib/pets";
import {
  filterFieldsByAudience,
  getAccountSection,
  type AccountField,
} from "@/lib/account-fields";

export const BOOKING_STEPS = [
  { id: 1, short: "Your Dog", label: "01 Your Dog" },
  { id: 2, short: "Date & Time", label: "02 Date & Time" },
  { id: 3, short: "Details", label: "03 Add Details" },
  { id: 4, short: "Care", label: "04 Care" },
  { id: 5, short: "Your Details", label: "05 Your Details" },
  { id: 6, short: "Payment", label: "06 Payment" },
  { id: 7, short: "Confirm", label: "07 Confirm" },
] as const;

export const BOOKING_PREP_PET_FIELD_IDS = [
  "temperament",
  "medicalNotes",
  "groomingPreferences",
] as const;

export const BOOKING_FINAL_STEP = BOOKING_STEPS.length;

export const DEFAULT_AVAILABILITY_SERVICE_ID = "signature-bath-care";

export function bookingDurationMinutes(
  serviceId: string | null | undefined,
  weightLbs: number,
  addOnIds: string[] = [],
) {
  return estimateServiceDurationMinutes(
    serviceId?.trim() || DEFAULT_AVAILABILITY_SERVICE_ID,
    weightLbs,
    addOnIds,
  );
}

export function createDraftBookingPet(): PetProfile {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `draft-${crypto.randomUUID()}`
      : `draft-${Date.now()}`;
  return {
    id,
    name: "",
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
    vaccinationBookingStatus: "missing",
    rabiesStatus: null,
  };
}

export function isPersistedPetId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export function getBookingCareCategories(
  weightLbs: number,
  options: { includeMembersOnly?: boolean } = {},
) {
  return groupServicesByCategory(
    getBookableServicesForPet(weightLbs, options),
  );
}

/** Toggle one open category; selecting a service always returns to the closed list. */
export function nextExpandedCareCategoryId(
  currentExpandedId: string | null,
  clickedCategoryId: string,
): string | null {
  return currentExpandedId === clickedCategoryId ? null : clickedCategoryId;
}

export type BookingCareChoice = {
  key: string;
  service: BookableService;
  optionName?: string;
  title: string;
  description: string;
  priceLabel: string;
};

export const BOOKING_SPA_GROUP_ID = "spa";
export const BOOKING_SPA_GROUP_NAME = "Spa";

export type BookingCareRow =
  | { kind: "service"; service: BookableService }
  | { kind: "spa-group"; services: BookableService[] };

export function bookingCareRowsForCategory(
  services: BookableService[],
): BookingCareRow[] {
  const rows: BookingCareRow[] = [];
  const spaServices: BookableService[] = [];

  for (const service of services) {
    if (isSpaService(service.id)) {
      spaServices.push(service);
    } else {
      rows.push({ kind: "service", service });
    }
  }

  if (spaServices.length) {
    rows.push({ kind: "spa-group", services: spaServices });
  }

  return rows;
}

export function bookingCareChoicesForService(service: BookableService): BookingCareChoice[] {
  if (isCreativeColoringCategory(service.categoryId) && service.options?.length) {
    return service.options.map((option) => ({
      key: `${service.id}:${option.name}`,
      service,
      optionName: option.name,
      title: option.name,
      description: option.description ?? "",
      priceLabel: coloringOptionPriceLabel(option),
    }));
  }

  return [
    {
      key: service.id,
      service,
      title: service.name,
      description: service.description,
      priceLabel: "",
    },
  ];
}

export function isBookingPrepPetFieldId(fieldId: string) {
  return (BOOKING_PREP_PET_FIELD_IDS as readonly string[]).includes(fieldId);
}

export function getBookingPrepPetFields(): AccountField[] {
  const fields = filterFieldsByAudience(
    getAccountSection("pets")?.fields ?? [],
    "customer",
  );
  return BOOKING_PREP_PET_FIELD_IDS.flatMap((id) => {
    const field = fields.find((item) => item.id === id);
    return field ? [field] : [];
  });
}

export function getBookingParkingField(): AccountField | undefined {
  return getAccountSection("addresses")?.fields.find(
    (field) => field.id === "parkingNotes",
  );
}
