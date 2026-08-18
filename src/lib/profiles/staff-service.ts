import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import {
  createAuthenticatedSupabaseClient,
} from "@/lib/pets/auth";
import { mapPetRowToRecord, mapValidatedInputToUpdateRow } from "@/lib/pets/map";
import type { PetRecord, PetRow, PetWriteInput } from "@/lib/pets/types";
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import {
  mapProfileRow,
  type CustomerProfile,
  type CustomerProfileRow,
} from "@/lib/profiles/types";
import {
  mapPaymentMethodRow,
  type PaymentMethodRecord,
  type PaymentMethodRow,
} from "@/lib/payments/types";

const PET_SELECT =
  "id, customer_id, name, breed, weight_lbs, date_of_birth, approximate_age_years, sex, temperament_notes, health_comfort_notes, grooming_preferences, archived_at, created_at, updated_at";

export type StaffCustomerRecord = {
  profile: CustomerProfile;
  pets: Array<PetRecord & { adminServiceNotes: string }>;
  paymentMethods: PaymentMethodRecord[];
};

type StaffPetEmbed = PetRow & {
  pet_admin_notes?: { notes: string } | { notes: string }[] | null;
};

function firstNotes(value: StaffPetEmbed["pet_admin_notes"]) {
  if (value == null) return "";
  return Array.isArray(value) ? (value[0]?.notes ?? "") : value.notes;
}

export async function listStaffCustomers(): Promise<
  | { customers: StaffCustomerRecord[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      `
      id, email, first_name, last_name, phone, preferred_contact,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      pets (
        ${PET_SELECT},
        pet_admin_notes ( notes )
      ),
      payment_methods (
        id, customer_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default
      )
    `,
    )
    .order("email", { ascending: true });

  if (error) {
    console.error("listStaffCustomers failed:", error.message);
    return { error: "server" };
  }

  const customers: StaffCustomerRecord[] = [];
  for (const row of data ?? []) {
    const profile = mapProfileRow(row as CustomerProfileRow);
    const petRows = ((row.pets ?? []) as StaffPetEmbed[]).filter(
      (pet) => pet.archived_at == null,
    );
    const petRecords = await attachVaccinationSummaries(
      petRows.map((pet) => mapPetRowToRecord(pet)),
    );
    const notesByPetId = new Map(
      petRows.map((pet) => [pet.id, firstNotes(pet.pet_admin_notes)]),
    );
    const paymentMethods = ((row.payment_methods ?? []) as PaymentMethodRow[]).map(
      mapPaymentMethodRow,
    );

    customers.push({
      profile,
      pets: petRecords.map((pet) => ({
        ...pet,
        adminServiceNotes: notesByPetId.get(pet.id) ?? "",
      })),
      paymentMethods,
    });
  }

  return { customers };
}

export async function updateStaffPet(
  petId: string,
  input: Partial<PetWriteInput>,
  adminServiceNotes?: string,
): Promise<
  | { pet: PetRecord & { adminServiceNotes: string } }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const supabase = await createAuthenticatedSupabaseClient();
  const updateRow = mapValidatedInputToUpdateRow(input);

  if (Object.keys(updateRow).length > 0) {
    if (updateRow.date_of_birth !== undefined && updateRow.date_of_birth !== null) {
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
      .is("archived_at", null)
      .select(PET_SELECT)
      .maybeSingle();

    if (error) {
      console.error("updateStaffPet failed:", error.message);
      if (error.code === "23514") return { error: "conflict" };
      return { error: "server" };
    }
    if (!data) return { error: "not_found" };
  }

  if (adminServiceNotes !== undefined) {
    const { error: notesError } = await supabase.rpc("staff_upsert_pet_admin_notes", {
      p_pet_id: petId,
      p_notes: adminServiceNotes,
    });
    if (notesError) {
      console.error("updateStaffPet notes failed:", notesError.message);
      return { error: "server" };
    }
  }

  const { data: petRow, error: reloadError } = await supabase
    .from("pets")
    .select(PET_SELECT)
    .eq("id", petId)
    .maybeSingle();

  if (reloadError || !petRow) {
    console.error("updateStaffPet reload failed:", reloadError?.message);
    return { error: "server" };
  }

  const [pet] = await attachVaccinationSummaries([
    mapPetRowToRecord(petRow as PetRow),
  ]);

  const { data: notesRow } = await supabase
    .from("pet_admin_notes")
    .select("notes")
    .eq("pet_id", petId)
    .maybeSingle();

  return {
    pet: {
      ...pet,
      adminServiceNotes: notesRow?.notes ?? "",
    },
  };
}
