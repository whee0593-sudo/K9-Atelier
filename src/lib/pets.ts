import { business } from "@/lib/business";

export type PetProfile = {
  id: string;
  name: string;
  breed: string;
  weightLbs: number;
  age?: string;
  sex?: string;
  temperament?: string;
  medicalNotes?: string;
  groomingPreferences?: string;
  adminServiceNotes?: string;
  vaccineExpiration?: string;
  vaccineRecordUploaded: boolean;
};

/** Demo profiles for preview until customer login is live */
export const demoPetProfiles: PetProfile[] = [
  {
    id: "pet-1",
    name: "Bella",
    breed: "Shih Tzu",
    weightLbs: 12,
    age: "8 years",
    sex: "Female, Spayed",
    vaccineRecordUploaded: true,
    vaccineExpiration: "2026-11-01",
  },
  {
    id: "pet-2",
    name: "Max",
    breed: "Miniature Poodle",
    weightLbs: 18,
    age: "3 years",
    sex: "Male, Neutered",
    adminServiceNotes: "Last visit: Signature Bath, lavender shampoo, nail grind.",
    vaccineRecordUploaded: false,
  },
];

export function formatPetSummary(pet: PetProfile) {
  return `${pet.name} · ${pet.breed} · ${pet.weightLbs} lbs`;
}

export function petReadyToBook(pet: PetProfile) {
  return pet.vaccineRecordUploaded;
}

/** Demo pets only in development or when explicitly enabled in business.json */
export function getCustomerPetProfiles(): PetProfile[] {
  if (business.site.useDemoPets === true) return demoPetProfiles;
  if (process.env.NODE_ENV === "development") return demoPetProfiles;
  return [];
}

export function petMayBenefitFromGentleCare(pet: PetProfile) {
  const ageMatch = pet.age?.match(/(\d+)/);
  const age = ageMatch ? Number.parseInt(ageMatch[1] ?? "0", 10) : 0;
  if (age >= 7) return true;
  const notes =
    `${pet.medicalNotes ?? ""} ${pet.temperament ?? ""}`.toLowerCase();
  return /senior|mobility|arthritis|surgery|recovery|limited|anxiety/.test(
    notes,
  );
}
