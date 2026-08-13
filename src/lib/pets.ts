import { formatPetAgeLabel, getPetAgeYears } from "@/lib/pet-age";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";
import { petProfileReadyToBook } from "@/lib/vaccinations/booking";

export type PetProfile = {
  id: string;
  name: string;
  breed: string;
  weightLbs: number;
  /** ISO date YYYY-MM-DD — exact date of birth */
  dateOfBirth?: string | null;
  /** ISO date YYYY-MM-DD — when exact date is unknown */
  approximateDateOfBirth?: string | null;
  /** Numeric fallback when exact DOB is unknown (Option A). */
  approximateAgeYears?: number | null;
  /** @deprecated Legacy field — mapped to approximateAgeYears when loading */
  ageYears?: number;
  sex?: string;
  temperament?: string;
  medicalNotes?: string;
  groomingPreferences?: string;
  adminServiceNotes?: string;
  vaccineExpiration?: string;
  vaccinationBookingStatus?: VaccinationBookingStatus;
  vaccineRecordUploaded: boolean;
};

export const demoPetProfiles: PetProfile[] = [
  {
    id: "pet-1",
    name: "Bella",
    breed: "Shih Tzu",
    weightLbs: 12,
    dateOfBirth: "2017-05-18",
    sex: "Female, Spayed",
    vaccineRecordUploaded: true,
    vaccinationBookingStatus: "current",
    vaccineExpiration: "2026-11-01",
  },
  {
    id: "pet-2",
    name: "Max",
    breed: "Miniature Poodle",
    weightLbs: 18,
    approximateDateOfBirth: "2023-06-15",
    sex: "Male, Neutered",
    adminServiceNotes: "Last visit: Signature Bath, lavender shampoo, nail grind.",
    vaccineRecordUploaded: false,
  },
];

export function normalizePetProfile(pet: PetProfile): PetProfile {
  const normalized: PetProfile = { ...pet };

  if (normalized.dateOfBirth) {
    normalized.approximateDateOfBirth = null;
    normalized.approximateAgeYears = null;
    normalized.ageYears = undefined;
    return normalized;
  }

  if (normalized.approximateDateOfBirth) {
    normalized.approximateAgeYears = null;
    normalized.ageYears = undefined;
    return normalized;
  }

  if (
    normalized.approximateAgeYears == null &&
    typeof normalized.ageYears === "number"
  ) {
    normalized.approximateAgeYears = normalized.ageYears;
  }

  return normalized;
}

export function saveCustomerPetProfiles(_pets: PetProfile[]) {
  // no-op — customer pets persist in Supabase
}

/** @deprecated Phase 3+ uses fetchCustomerPets(). Returns empty for legacy callers. */
export function getCustomerPetProfiles(): PetProfile[] {
  return [];
}

export function formatPetSummary(pet: PetProfile) {
  return `${pet.breed} · ${pet.weightLbs} lbs`;
}

export function formatPetBookingCardLine(pet: PetProfile) {
  const age = getPetAgeYears(pet);
  const base = formatPetSummary(pet);
  if (age == null) return base;
  return `${base} · ${formatPetAgeLabel(age)}`;
}

export function petReadyToBook(pet: PetProfile) {
  return petProfileReadyToBook(pet);
}

export function petMayBenefitFromGentleCare(pet: PetProfile) {
  const age = getPetAgeYears(pet) ?? 0;
  if (age >= 7) return true;
  const notes =
    `${pet.medicalNotes ?? ""} ${pet.temperament ?? ""}`.toLowerCase();
  return /senior|mobility|arthritis|surgery|recovery|limited|anxiety/.test(
    notes,
  );
}
