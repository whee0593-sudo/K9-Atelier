import {
  mapPetRowToRecord,
  mapValidatedInputToInsertRow,
  mapValidatedInputToUpdateRow,
} from "@/lib/pets/map";
import type { PetRecord, PetRow, PetWriteInput } from "@/lib/pets/types";
import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { PetValidationError } from "@/lib/pets/validation";

const PET_SELECT =
  "id, customer_id, name, breed, weight_lbs, date_of_birth, approximate_age_years, sex, temperament_notes, health_comfort_notes, grooming_preferences, archived_at, created_at, updated_at";

export async function listPets(): Promise<
  { pets: PetRecord[] } | { error: "unauthenticated" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("pets")
    .select(PET_SELECT)
    .eq("customer_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listPets failed:", error.code, error.message);
    return { error: "server" };
  }

  return {
    pets: (data as PetRow[]).map(mapPetRowToRecord),
  };
}

export async function createPet(
  input: PetWriteInput,
): Promise<
  { pet: PetRecord } | { error: "unauthenticated" | "server" | "conflict" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const insertRow = mapValidatedInputToInsertRow(input);

  const { data, error } = await supabase
    .from("pets")
    .insert(insertRow)
    .select(PET_SELECT)
    .single();

  if (error) {
    console.error("createPet failed:", error.code, error.message);
    if (error.code === "23514" || error.code === "23505") {
      return { error: "conflict" };
    }
    return { error: "server" };
  }

  return { pet: mapPetRowToRecord(data as PetRow) };
}

export async function updatePet(
  petId: string,
  input: Partial<PetWriteInput>,
): Promise<
  { pet: PetRecord } | { error: "unauthenticated" | "not_found" | "server" | "conflict" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const updateRow = mapValidatedInputToUpdateRow(input);

  if (Object.keys(updateRow).length === 0) {
    throw new PetValidationError("No valid fields provided to update.");
  }

  if (
    updateRow.date_of_birth !== undefined &&
    updateRow.date_of_birth !== null
  ) {
    updateRow.approximate_age_years = null;
  } else if (
    updateRow.approximate_age_years !== undefined &&
    updateRow.approximate_age_years !== null
  ) {
    updateRow.date_of_birth = null;
  }

  const { data, error } = await supabase
    .from("pets")
    .update(updateRow)
    .eq("id", petId)
    .eq("customer_id", user.id)
    .is("archived_at", null)
    .select(PET_SELECT)
    .maybeSingle();

  if (error) {
    console.error("updatePet failed:", error.code, error.message);
    if (error.code === "23514") return { error: "conflict" };
    return { error: "server" };
  }

  if (!data) return { error: "not_found" };

  return { pet: mapPetRowToRecord(data as PetRow) };
}

export async function archivePet(
  petId: string,
): Promise<{ ok: true } | { error: "unauthenticated" | "not_found" | "server" }> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();

  const { data: archived, error } = await supabase.rpc("archive_own_pet", {
    p_pet_id: petId,
  });

  if (error) {
    console.error(
      "archivePet failed:",
      error.code,
      error.message,
      error.hint ?? "",
    );
    return { error: "server" };
  }

  if (!archived) return { error: "not_found" };

  return { ok: true };
}
