import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { OWNER_EMAIL, normalizeStaffEmail } from "@/lib/staff/owner";
import {
  createAuthenticatedSupabaseClient,
} from "@/lib/pets/auth";
import { mapPetRowToRecord, mapValidatedInputToUpdateRow } from "@/lib/pets/map";
import type { PetRecord, PetRow, PetWriteInput } from "@/lib/pets/types";
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import {
  customerDeleteBlockReason,
  isProtectedStaffEmail,
} from "@/lib/profiles/delete-guard";
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
  canDelete: boolean;
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
  const staffEmails = await listProtectedStaffEmails(admin);
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
      canDelete: !customerDeleteBlockReason({
        actorUserId: session.user.id,
        targetUserId: profile.id,
        targetEmail: profile.email,
        targetIsStaff: isProtectedStaffEmail(profile.email, staffEmails),
      }),
    });
  }

  return { customers };
}

export async function deleteStaffCustomer(customerId: string): Promise<
  | { ok: true }
  | {
      error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", customerId)
    .maybeSingle();

  if (profileError) {
    console.error("deleteStaffCustomer profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return { error: "not_found" };

  const staffEmails = await listProtectedStaffEmails(admin);
  const blocked = customerDeleteBlockReason({
    actorUserId: session.user.id,
    targetUserId: profile.id,
    targetEmail: profile.email,
    targetIsStaff: isProtectedStaffEmail(profile.email, staffEmails),
  });
  if (blocked) return { error: "conflict", message: blocked };

  const cleaned = await deleteCustomerDependentRows(admin, profile.id);
  if (!cleaned) return { error: "server" };

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.id);
  if (deleteUserError) {
    console.error("deleteStaffCustomer auth failed:", deleteUserError.message);
    return { error: "server" };
  }

  return { ok: true };
}

async function listProtectedStaffEmails(
  admin: ReturnType<typeof createAdminClient>,
) {
  const emails = new Set<string>([OWNER_EMAIL]);
  const [members, invites] = await Promise.all([
    admin.schema("private").from("staff_members").select("email"),
    admin.schema("private").from("staff_invites").select("email"),
  ]);

  for (const row of members.data ?? []) {
    if (row.email) emails.add(normalizeStaffEmail(row.email));
  }
  for (const row of invites.data ?? []) {
    if (row.email) emails.add(normalizeStaffEmail(row.email));
  }
  return emails;
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    /schema cache|does not exist|could not find the table/i.test(
      error.message ?? "",
    )
  );
}

async function ignoreMissingTable(
  label: string,
  result: { error: { message: string } | null },
) {
  if (result.error && !isMissingTableError(result.error)) {
    console.error(`deleteStaffCustomer ${label} failed:`, result.error.message);
    return false;
  }
  return true;
}

async function deleteCustomerDependentRows(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
) {
  const { data: relationships, error: relationshipsError } = await admin
    .from("referral_relationships")
    .select("id")
    .or(
      `referrer_customer_id.eq.${customerId},referred_customer_id.eq.${customerId}`,
    );
  if (relationshipsError && !isMissingTableError(relationshipsError)) {
    console.error(
      "deleteStaffCustomer relationships failed:",
      relationshipsError.message,
    );
    return false;
  }

  const relationshipIds = (relationships ?? []).map((row) => row.id as string);
  const { data: sources, error: sourcesError } = await admin
    .from("referral_reward_sources")
    .select("id")
    .or(
      `referrer_customer_id.eq.${customerId},referred_customer_id.eq.${customerId}`,
    );
  if (sourcesError && !isMissingTableError(sourcesError)) {
    console.error("deleteStaffCustomer sources failed:", sourcesError.message);
    return false;
  }
  const sourceIds = (sources ?? []).map((row) => row.id as string);

  if (
    !(await ignoreMissingTable(
      "audit by customer",
      await admin.from("referral_audit_log").delete().eq("customer_id", customerId),
    ))
  ) {
    return false;
  }

  if (relationshipIds.length > 0) {
    if (
      !(await ignoreMissingTable(
        "audit by relationship",
        await admin
          .from("referral_audit_log")
          .delete()
          .in("referral_relationship_id", relationshipIds),
      ))
    ) {
      return false;
    }
  }

  if (sourceIds.length > 0) {
    if (
      !(await ignoreMissingTable(
        "ledger reversals by source",
        await admin
          .from("referral_credit_ledger")
          .delete()
          .in("reward_source_id", sourceIds)
          .eq("entry_type", "reversal"),
      )) ||
      !(await ignoreMissingTable(
        "ledger by source",
        await admin
          .from("referral_credit_ledger")
          .delete()
          .in("reward_source_id", sourceIds),
      ))
    ) {
      return false;
    }
  }

  if (
    !(await ignoreMissingTable(
      "ledger reversals",
      await admin
        .from("referral_credit_ledger")
        .delete()
        .eq("customer_id", customerId)
        .eq("entry_type", "reversal"),
    )) ||
    !(await ignoreMissingTable(
      "ledger",
      await admin.from("referral_credit_ledger").delete().eq("customer_id", customerId),
    ))
  ) {
    return false;
  }

  if (sourceIds.length > 0) {
    if (
      !(await ignoreMissingTable(
        "reward sources",
        await admin.from("referral_reward_sources").delete().in("id", sourceIds),
      ))
    ) {
      return false;
    }
  }

  if (relationshipIds.length > 0) {
    if (
      !(await ignoreMissingTable(
        "relationships",
        await admin.from("referral_relationships").delete().in("id", relationshipIds),
      ))
    ) {
      return false;
    }
  }

  if (
    !(await ignoreMissingTable(
      "vaccinations",
      await admin.from("pet_vaccination_records").delete().eq("customer_id", customerId),
    )) ||
    !(await ignoreMissingTable(
      "appointments",
      await admin.from("appointments").delete().eq("customer_id", customerId),
    ))
  ) {
    return false;
  }

  return true;
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
