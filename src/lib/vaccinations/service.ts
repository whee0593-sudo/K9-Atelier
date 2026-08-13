import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { mapPetRowToRecord } from "@/lib/pets/map";
import type { PetRecord, PetRow } from "@/lib/pets/types";
import {
  detectVaccinationMimeType,
  extensionForMime,
} from "@/lib/vaccinations/magic-bytes";
import {
  enrichPetRecordsWithVaccination,
  fetchPetVaccinationSummary,
} from "@/lib/vaccinations/status";
import { VACCINATION_BUCKET } from "@/lib/vaccinations/types";
import {
  sanitizeOriginalFilename,
  validateVaccinationExpirationDate,
  validateVaccinationFileSize,
} from "@/lib/vaccinations/validation";

export type VaccinationUploadInput = {
  fileBuffer: Buffer;
  originalFilename: string;
  expirationDate?: string | null;
};

async function enrichSinglePetRecord(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>,
  pet: PetRecord,
): Promise<PetRecord> {
  const [enriched] = await enrichPetRecordsWithVaccination(supabase, [pet]);
  return enriched;
}

export async function attachVaccinationSummaries(
  pets: PetRecord[],
): Promise<PetRecord[]> {
  if (pets.length === 0) return pets;
  const supabase = await createAuthenticatedSupabaseClient();
  return enrichPetRecordsWithVaccination(supabase, pets);
}

export async function uploadPetVaccination(
  petId: string,
  input: VaccinationUploadInput,
): Promise<
  | { pet: PetRecord }
  | {
      error:
        | "unauthenticated"
        | "not_found"
        | "invalid_file"
        | "server"
        | "misconfigured";
    }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  if (!hasSupabaseAdminConfig()) {
    console.error("uploadPetVaccination: missing SUPABASE_SECRET_KEY");
    return { error: "misconfigured" };
  }

  validateVaccinationFileSize(input.fileBuffer.length);
  const expirationDate = validateVaccinationExpirationDate(input.expirationDate);

  const mimeType = detectVaccinationMimeType(input.fileBuffer);
  if (!mimeType) {
    return { error: "invalid_file" };
  }

  const supabase = await createAuthenticatedSupabaseClient();
  const { data: petRow, error: petError } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("customer_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) {
    console.error("uploadPetVaccination pet lookup failed:", petError.message);
    return { error: "server" };
  }
  if (!petRow) return { error: "not_found" };

  const recordId = randomUUID();
  const extension = extensionForMime(mimeType);
  const storagePath = `${user.id}/${petId}/${recordId}.${extension}`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(VACCINATION_BUCKET)
    .upload(storagePath, input.fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error(
      "uploadPetVaccination storage upload failed:",
      uploadError.message,
    );
    if (/invalid compact jws/i.test(uploadError.message)) {
      return { error: "invalid_key" };
    }
    return { error: "server" };
  }

  const { data: inserted, error: insertError } = await admin
    .from("pet_vaccination_records")
    .insert({
      id: recordId,
      pet_id: petId,
      storage_path: storagePath,
      original_filename: sanitizeOriginalFilename(input.originalFilename),
      mime_type: mimeType,
      file_size_bytes: input.fileBuffer.length,
      expiration_date: expirationDate,
    })
    .select("pet_id")
    .single();

  if (insertError) {
    console.error(
      "uploadPetVaccination insert failed:",
      insertError.code,
      insertError.message,
    );
    await admin.storage.from(VACCINATION_BUCKET).remove([storagePath]);
    return { error: "server" };
  }

  if (!inserted) {
    await admin.storage.from(VACCINATION_BUCKET).remove([storagePath]);
    return { error: "server" };
  }

  const { data: refreshedPet, error: refreshError } = await supabase
    .from("pets")
    .select(
      "id, customer_id, name, breed, weight_lbs, date_of_birth, approximate_age_years, sex, temperament_notes, health_comfort_notes, grooming_preferences, archived_at, created_at, updated_at",
    )
    .eq("id", petId)
    .maybeSingle();

  if (refreshError || !refreshedPet) {
    console.error("uploadPetVaccination refresh failed:", refreshError?.message);
    return { error: "server" };
  }

  const pet = mapPetRowToRecord(refreshedPet as PetRow);
  const enriched = await enrichSinglePetRecord(supabase, pet);
  return { pet: enriched };
}

export async function getPetVaccinationSummaryForPet(petId: string) {
  const supabase = await createAuthenticatedSupabaseClient();
  return fetchPetVaccinationSummary(supabase, petId);
}
