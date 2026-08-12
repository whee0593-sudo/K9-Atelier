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
};

export type PetUpdateRow = Partial<PetInsertRow>;

export const PET_SEX_OPTIONS = [
  "Male",
  "Female",
  "Male, Neutered",
  "Female, Spayed",
] as const;

export type PetSex = (typeof PET_SEX_OPTIONS)[number];
