export const VACCINATION_BUCKET = "pet-vaccinations";

export const MAX_VACCINATION_FILE_BYTES = 4_194_304;

export type VaccinationBookingStatus =
  | "current"
  | "expiring_soon"
  | "needs_review"
  | "needs_attention"
  | "expired"
  | "missing";

export type PetVaccinationSummary = {
  bookingStatus: VaccinationBookingStatus;
  expirationDate: string | null;
  hasUpload: boolean;
};
