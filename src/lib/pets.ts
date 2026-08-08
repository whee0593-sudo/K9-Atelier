import { business } from "@/lib/business";
import { formatPetAgeLabel, getPetAgeYears } from "@/lib/pet-age";

export type PetProfile = {
  id: string;
  name: string;
  breed: string;
  weightLbs: number;
  /** ISO date YYYY-MM-DD — exact date of birth */
  dateOfBirth?: string | null;
  /** ISO date YYYY-MM-DD — when exact date is unknown */
  approximateDateOfBirth?: string | null;
  /** @deprecated Legacy fallback — use approximateDateOfBirth when possible */
  approximateAgeYears?: number | null;
  /** @deprecated Legacy field — mapped to approximateAgeYears when loading */
  ageYears?: number;
  sex?: string;
  temperament?: string;
  medicalNotes?: string;
  groomingPreferences?: string;
  adminServiceNotes?: string;
  vaccineExpiration?: string;
  vaccineRecordUploaded: boolean;
};

const CUSTOMER_PETS_STORAGE_KEY = "k9-atelier-customer-pets";

/** Demo profiles for preview until customer login is live */
export const demoPetProfiles: PetProfile[] = [
  {
    id: "pet-1",
    name: "Bella",
    breed: "Shih Tzu",
    weightLbs: 12,
    dateOfBirth: "2017-05-18",
    sex: "Female, Spayed",
    vaccineRecordUploaded: true,
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

function readStoredPetProfiles(): PetProfile[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CUSTOMER_PETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PetProfile[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizePetProfile);
  } catch {
    return null;
  }
}

export function saveCustomerPetProfiles(pets: PetProfile[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CUSTOMER_PETS_STORAGE_KEY,
    JSON.stringify(pets.map(normalizePetProfile)),
  );
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
  return pet.vaccineRecordUploaded;
}

function getBasePetProfiles(): PetProfile[] {
  if (business.site.useDemoPets === true) return demoPetProfiles;
  if (process.env.NODE_ENV === "development") return demoPetProfiles;
  return [];
}

/** Demo pets in development, with optional browser persistence after edits. */
export function getCustomerPetProfiles(): PetProfile[] {
  const stored = readStoredPetProfiles();
  if (stored) return stored;
  return getBasePetProfiles().map(normalizePetProfile);
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
