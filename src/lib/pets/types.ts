export const PET_RABIES_STATUSES = ["current", "medical_exemption"] as const;

export type PetRabiesStatus = (typeof PET_RABIES_STATUSES)[number];

export function parsePetRabiesStatus(
  value: unknown,
): PetRabiesStatus | null {
  if (
    typeof value === "string" &&
    PET_RABIES_STATUSES.includes(value as PetRabiesStatus)
  ) {
    return value as PetRabiesStatus;
  }
  return null;
}

export const PET_SELECT =
  "id, customer_id, name, breed, weight_lbs, date_of_birth, approximate_age_years, sex, temperament_notes, health_comfort_notes, grooming_preferences, rabies_status, archived_at, created_at, updated_at";

/** Database row shape (snake_case). */
export type PetRow = {
  id: string;
  customer_id: string;
  name: string;
  breed: string;
  weight_lbs: number;
  date_of_birth: string | null;
  approximate_age_years: number | null;
  sex: string | null;
  temperament_notes: string | null;
  health_comfort_notes: string | null;
  grooming_preferences: string | null;
  rabies_status?: PetRabiesStatus | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Server/API pet record (camelCase). */
export type PetRecord = {
  id: string;
  name: string;
  breed: string;
  weightLbs: number;
  dateOfBirth: string | null;
  approximateAgeYears: number | null;
  sex: string | null;
  temperamentNotes: string | null;
  healthComfortNotes: string | null;
  groomingPreferences: string | null;
  rabiesStatus?: PetRabiesStatus | null;
  vaccinationBookingStatus?:
    import("@/lib/vaccinations/types").VaccinationBookingStatus;
  vaccinationExpirationDate?: string | null;
  vaccinationHasUpload?: boolean;
  vaccinationLatestRecordId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetWriteInput = {
  name: string;
  breed: string;
  weightLbs: number;
  dateOfBirth?: string | null;
  approximateAgeYears?: number | null;
  sex?: string | null;
  temperamentNotes?: string | null;
  healthComfortNotes?: string | null;
  groomingPreferences?: string | null;
  rabiesStatus?: PetRabiesStatus | null;
};

export type PetInsertRow = {
  name: string;
  breed: string;
  weight_lbs: number;
  date_of_birth: string | null;
  approximate_age_years: number | null;
  sex: string | null;
  temperament_notes: string | null;
  health_comfort_notes: string | null;
  grooming_preferences: string | null;
  rabies_status: PetRabiesStatus | null;
};

export type PetUpdateRow = Partial<PetInsertRow>;

export const PET_SEX_OPTIONS = [
  "Male",
  "Female",
  "Male, Neutered",
  "Female, Spayed",
] as const;

export type PetSex = (typeof PET_SEX_OPTIONS)[number];
