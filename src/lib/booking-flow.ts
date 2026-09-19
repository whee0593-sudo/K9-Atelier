import {
  estimateServiceDurationMinutes,
  getBookableServicesForPet,
  groupServicesByCategory,
  isCreativeColoringCategory,
  type BookableService,
} from "@/lib/services";
import { coloringOptionPriceLabel } from "@/lib/service-page";
import type { PetProfile } from "@/lib/pets";

export const BOOKING_STEPS = [
  { id: 1, short: "Your Dog", label: "01 Your Dog" },
  { id: 2, short: "Date & Time", label: "02 Date & Time" },
  { id: 3, short: "Care", label: "03 Care" },
  { id: 4, short: "Your Details", label: "04 Your Details" },
  { id: 5, short: "Payment", label: "05 Payment" },
  { id: 6, short: "Confirm", label: "06 Confirm" },
] as const;

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
