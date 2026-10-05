import type { PetRecord, PetRow, PetWriteInput } from "@/lib/pets/types";
import { parsePetRabiesStatus } from "@/lib/pets/types";
import type { PetProfile } from "@/lib/pets";
import { getPetAgeYears } from "@/lib/pet-age";
import {
  vaccinationHasUpload,
} from "@/lib/vaccinations/booking";

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? null;
}

/** Profile expiration: the date saved on the pet, then a date on an uploaded record. */
export function displayedRabiesExpiration(
  record: Pick<PetRecord, "rabiesExpirationDate" | "vaccinationExpirationDate">,
): string | undefined {
  return (
    dateOnly(record.rabiesExpirationDate) ??
    dateOnly(record.vaccinationExpirationDate) ??
    undefined
  );
}

export function mapPetRowToRecord(row: PetRow): PetRecord {
  return {
    id: row.id,
    name: row.name,
    breed: row.breed,
    weightLbs: Number(row.weight_lbs),
    dateOfBirth: row.date_of_birth,
    approximateAgeYears:
      row.approximate_age_years == null
        ? null
        : Number(row.approximate_age_years),
    sex: row.sex,
    temperamentNotes: row.temperament_notes,
    healthComfortNotes: row.health_comfort_notes,
    groomingPreferences: row.grooming_preferences,
    rabiesStatus: parsePetRabiesStatus(row.rabies_status),
    rabiesExpirationDate: dateOnly(row.rabies_expiration_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Bridge DB records to the existing booking/account UI model. */
export function mapPetRecordToUiProfile(record: PetRecord): PetProfile {
  return {
    id: record.id,
    name: record.name,
    breed: record.breed,
    weightLbs: record.weightLbs,
    dateOfBirth: record.dateOfBirth,
    approximateDateOfBirth: null,
    approximateAgeYears: record.approximateAgeYears,
    sex: record.sex ?? undefined,
    temperament: record.temperamentNotes ?? undefined,
    medicalNotes: record.healthComfortNotes ?? undefined,
    groomingPreferences: record.groomingPreferences ?? undefined,
    rabiesStatus: parsePetRabiesStatus(record.rabiesStatus),
    vaccineExpiration: displayedRabiesExpiration(record),
    vaccinationBookingStatus: record.vaccinationBookingStatus ?? "missing",
    vaccineRecordUploaded: vaccinationHasUpload(record),
    vaccinationLatestRecordId: record.vaccinationLatestRecordId ?? null,
  };
}

export function mapPetProfileToWriteInput(pet: PetProfile): PetWriteInput {
  let dateOfBirth = pet.dateOfBirth ?? null;
  let approximateAgeYears = pet.approximateAgeYears ?? null;

  if (dateOfBirth) {
    approximateAgeYears = null;
  } else if (pet.approximateDateOfBirth) {
    approximateAgeYears = getPetAgeYears({
      approximateDateOfBirth: pet.approximateDateOfBirth,
    });
    dateOfBirth = null;
  }

  return {
    name: pet.name.trim(),
    breed: pet.breed.trim(),
    weightLbs: pet.weightLbs,
    dateOfBirth,
    approximateAgeYears,
    sex: pet.sex ?? null,
    temperamentNotes: pet.temperament ?? null,
    healthComfortNotes: pet.medicalNotes ?? null,
    groomingPreferences: pet.groomingPreferences ?? null,
    rabiesStatus: parsePetRabiesStatus(pet.rabiesStatus),
    rabiesExpirationDate: dateOnly(pet.vaccineExpiration),
  };
}

export function mapValidatedInputToInsertRow(
  input: PetWriteInput,
): import("@/lib/pets/types").PetInsertRow {
  return {
    name: input.name,
    breed: input.breed,
    weight_lbs: input.weightLbs,
    date_of_birth: input.dateOfBirth ?? null,
    approximate_age_years: input.approximateAgeYears ?? null,
    sex: input.sex ?? null,
    temperament_notes: input.temperamentNotes ?? null,
    health_comfort_notes: input.healthComfortNotes ?? null,
    grooming_preferences: input.groomingPreferences ?? null,
    rabies_status: parsePetRabiesStatus(input.rabiesStatus),
    rabies_expiration_date: dateOnly(input.rabiesExpirationDate),
  };
}

export function mapValidatedInputToUpdateRow(
  input: Partial<PetWriteInput>,
): import("@/lib/pets/types").PetUpdateRow {
  const row: import("@/lib/pets/types").PetUpdateRow = {};

  if (input.name !== undefined) row.name = input.name;
  if (input.breed !== undefined) row.breed = input.breed;
  if (input.weightLbs !== undefined) row.weight_lbs = input.weightLbs;
  if (input.dateOfBirth !== undefined) row.date_of_birth = input.dateOfBirth;
  if (input.approximateAgeYears !== undefined) {
    row.approximate_age_years = input.approximateAgeYears;
  }
  if (input.sex !== undefined) row.sex = input.sex;
  if (input.temperamentNotes !== undefined) {
    row.temperament_notes = input.temperamentNotes;
  }
  if (input.healthComfortNotes !== undefined) {
    row.health_comfort_notes = input.healthComfortNotes;
  }
  if (input.groomingPreferences !== undefined) {
    row.grooming_preferences = input.groomingPreferences;
  }
  if (input.rabiesStatus !== undefined) {
    row.rabies_status = parsePetRabiesStatus(input.rabiesStatus);
  }
  if (input.rabiesExpirationDate !== undefined) {
    row.rabies_expiration_date = dateOnly(input.rabiesExpirationDate);
  }

  return row;
}
