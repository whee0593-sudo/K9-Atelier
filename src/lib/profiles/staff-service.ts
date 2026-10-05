import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerSession, getStaffSession } from "@/lib/staff/auth";
import { isOwnerEmail, OWNER_EMAIL, normalizeStaffEmail } from "@/lib/staff/owner";
import {
  createAuthenticatedSupabaseClient,
} from "@/lib/pets/auth";
import { mapPetRowToRecord, mapValidatedInputToInsertRow, mapValidatedInputToUpdateRow } from "@/lib/pets/map";
import {
  PET_SELECT,
  type PetRecord,
  type PetRow,
  type PetWriteInput,
} from "@/lib/pets/types";
import {
  attachVaccinationSummaries,
  syncPetRabiesExpiration,
} from "@/lib/vaccinations/service";
import {
  FREEZE_BAN_DURATION,
  isFrozenAuthUser,
} from "@/lib/auth/frozen-account";
import {
  isAdminAccountEmail,
  ownerAccountActionBlockReason,
} from "@/lib/profiles/delete-guard";
import {
  mapProfileRow,
  type CustomerProfile,
  type CustomerProfileRow,
} from "@/lib/profiles/types";
import type { StaffCustomerCreateInput } from "@/lib/profiles/validation";
import type { OptionalStaffPetInput } from "@/lib/pets/validation";
import {
  mapPaymentMethodRow,
  type PaymentMethodRecord,
  type PaymentMethodRow,
} from "@/lib/payments/types";

export type StaffCustomerKind = "admin" | "customer";

export type StaffCustomerRecord = {
  profile: CustomerProfile;
  pets: Array<PetRecord & { adminServiceNotes: string }>;
  paymentMethods: PaymentMethodRecord[];
  kind: StaffCustomerKind;
  frozen: boolean;
  canDelete: boolean;
  canFreeze: boolean;
};

type StaffPetEmbed = PetRow & {
  pet_admin_notes?: { notes: string } | { notes: string }[] | null;
};

function firstNotes(value: StaffPetEmbed["pet_admin_notes"]) {
  if (value == null) return "";
  return Array.isArray(value) ? (value[0]?.notes ?? "") : value.notes;
}

export async function listStaffCustomers(): Promise<
  | { admins: StaffCustomerRecord[]; customers: StaffCustomerRecord[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const actorIsOwner = isOwnerEmail(session.user.email);
  const [staffEmails, authUsers, profilesResult] = await Promise.all([
    listProtectedStaffEmails(admin),
    listAuthUsersById(admin),
    admin
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
      .order("email", { ascending: true }),
  ]);

  if (profilesResult.error) {
    console.error("listStaffCustomers failed:", profilesResult.error.message);
    return { error: "server" };
  }

  const admins: StaffCustomerRecord[] = [];
  const customers: StaffCustomerRecord[] = [];
  for (const row of profilesResult.data ?? []) {
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
    const kind: StaffCustomerKind = isAdminAccountEmail(profile.email, staffEmails)
      ? "admin"
      : "customer";
    const actionInput = {
      actorIsOwner,
      actorUserId: session.user.id,
      targetUserId: profile.id,
      targetEmail: profile.email,
    };
    const record: StaffCustomerRecord = {
      profile,
      pets: petRecords.map((pet) => ({
        ...pet,
        adminServiceNotes: notesByPetId.get(pet.id) ?? "",
      })),
      paymentMethods,
      kind,
      frozen: isFrozenAuthUser(authUsers.get(profile.id) ?? null),
      canDelete: !ownerAccountActionBlockReason({
        ...actionInput,
        action: "delete",
      }),
      canFreeze: !ownerAccountActionBlockReason({
        ...actionInput,
        action: "freeze",
      }),
    };
    if (kind === "admin") admins.push(record);
    else customers.push(record);
  }

  admins.sort((left, right) => {
    const leftOwner = isOwnerEmail(left.profile.email) ? 0 : 1;
    const rightOwner = isOwnerEmail(right.profile.email) ? 0 : 1;
    if (leftOwner !== rightOwner) return leftOwner - rightOwner;
    return left.profile.email.localeCompare(right.profile.email);
  });

  return { admins, customers };
}

export async function deleteStaffCustomer(customerId: string): Promise<
  | { ok: true }
  | {
      error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server";
      message?: string;
    }
> {
  const session = await getOwnerSession();
  if ("error" in session) {
    if (session.error === "forbidden") {
      return { error: "forbidden", message: "Only the owner can delete accounts." };
    }
    return session;
  }

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

  const blocked = ownerAccountActionBlockReason({
    action: "delete",
    actorIsOwner: true,
    actorUserId: session.user.id,
    targetUserId: profile.id,
    targetEmail: profile.email,
  });
  if (blocked) return { error: "conflict", message: blocked };

  const cleaned = await deleteCustomerDependentRows(admin, profile.id);
  if (!cleaned) return { error: "server" };
  await deleteStaffMembership(admin, profile.id, profile.email);

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.id);
  if (deleteUserError) {
    console.error("deleteStaffCustomer auth failed:", deleteUserError.message);
    return { error: "server" };
  }

  return { ok: true };
}

export async function setStaffCustomerFrozen(
  customerId: string,
  frozen: boolean,
): Promise<
  | { frozen: boolean }
  | {
      error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server";
      message?: string;
    }
> {
  const session = await getOwnerSession();
  if ("error" in session) {
    if (session.error === "forbidden") {
      return { error: "forbidden", message: "Only the owner can freeze accounts." };
    }
    return session;
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", customerId)
    .maybeSingle();

  if (profileError) {
    console.error("setStaffCustomerFrozen profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return { error: "not_found" };

  const blocked = ownerAccountActionBlockReason({
    action: "freeze",
    actorIsOwner: true,
    actorUserId: session.user.id,
    targetUserId: profile.id,
    targetEmail: profile.email,
  });
  if (blocked) return { error: "conflict", message: blocked };

  const { data: authUser, error: getUserError } =
    await admin.auth.admin.getUserById(profile.id);
  if (getUserError || !authUser.user) {
    console.error(
      "setStaffCustomerFrozen getUser failed:",
      getUserError?.message ?? "missing user",
    );
    return { error: "not_found" };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    ban_duration: frozen ? FREEZE_BAN_DURATION : "none",
    app_metadata: {
      ...authUser.user.app_metadata,
      frozen,
    },
  });
  if (updateError) {
    console.error("setStaffCustomerFrozen update failed:", updateError.message);
    return { error: "server" };
  }

  return { frozen };
}

async function listAuthUsersById(
  admin: ReturnType<typeof createAdminClient>,
) {
  const users = new Map<string, User>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("listAuthUsersById failed:", error.message);
      break;
    }
    for (const user of data.users) {
      users.set(user.id, user);
    }
    if (data.users.length < 200) break;
  }
  return users;
}

async function deleteStaffMembership(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string | null,
) {
  await admin.schema("private").from("staff_members").delete().eq("user_id", userId);
  if (email) {
    await admin
      .schema("private")
      .from("staff_invites")
      .delete()
      .eq("email_normalized", normalizeStaffEmail(email));
  }
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

  // Match createStaffPet / archiveStaffPet: staff writes use the privileged
  // client so new columns (e.g. rabies_status) are not blocked by column grants.
  const admin = createAdminClient();
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

    const { data, error } = await admin
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

  if (input.rabiesExpirationDate !== undefined) {
    await syncPetRabiesExpiration(petId, input.rabiesExpirationDate ?? null);
  }

  if (adminServiceNotes !== undefined) {
    // SECURITY DEFINER RPC still needs the staff JWT so private.is_staff() passes.
    const supabase = await createAuthenticatedSupabaseClient();
    const { error: notesError } = await supabase.rpc("staff_upsert_pet_admin_notes", {
      p_pet_id: petId,
      p_notes: adminServiceNotes,
    });
    if (notesError) {
      console.error("updateStaffPet notes failed:", notesError.message);
      return { error: "server" };
    }
  }

  return loadStaffPetWithNotes(petId);
}

async function loadStaffPetWithNotes(
  petId: string,
): Promise<
  | { pet: PetRecord & { adminServiceNotes: string } }
  | { error: "server" | "not_found" }
> {
  const admin = createAdminClient();
  const { data: petRow, error: reloadError } = await admin
    .from("pets")
    .select(PET_SELECT)
    .eq("id", petId)
    .maybeSingle();

  if (reloadError) {
    console.error("loadStaffPetWithNotes failed:", reloadError.message);
    return { error: "server" };
  }
  if (!petRow) return { error: "not_found" };

  const [pet] = await attachVaccinationSummaries([
    mapPetRowToRecord(petRow as PetRow),
  ]);

  const { data: notesRow } = await admin
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

export async function createStaffPet(
  customerId: string,
  input: PetWriteInput,
): Promise<
  | { pet: PetRecord & { adminServiceNotes: string } }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();
  if (profileError) {
    console.error("createStaffPet profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return { error: "not_found" };

  const { data, error } = await admin
    .from("pets")
    .insert({
      customer_id: customerId,
      ...mapValidatedInputToInsertRow(input),
    })
    .select(PET_SELECT)
    .single();

  if (error) {
    console.error("createStaffPet failed:", error.code, error.message);
    if (error.code === "23514" || error.code === "23505") {
      return { error: "conflict" };
    }
    return { error: "server" };
  }

  const pet = mapPetRowToRecord(data as PetRow);
  try {
    const { ensurePetReferralCode } = await import("@/lib/referrals/service");
    await ensurePetReferralCode({
      petId: pet.id,
      petName: pet.name,
      ownerCustomerId: customerId,
    });
  } catch (referralError) {
    console.error("createStaffPet referral code failed:", referralError);
  }

  const loaded = await loadStaffPetWithNotes(pet.id);
  if ("error" in loaded) return loaded;
  return loaded;
}

export async function archiveStaffPet(
  customerId: string,
  petId: string,
): Promise<{ ok: true } | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pets")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", petId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("archiveStaffPet failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };

  const { error: referralError } = await admin
    .from("pet_referral_codes")
    .update({ is_active: false })
    .eq("pet_id", petId);
  if (referralError && !isMissingTableError(referralError)) {
    console.error("archiveStaffPet referral codes failed:", referralError.message);
  }

  return { ok: true };
}

export async function setStaffCustomerPassword(
  customerId: string,
  password: string,
): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();
  if (profileError) {
    console.error("setStaffCustomerPassword profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return { error: "not_found" };

  const { error: updateError } = await admin.auth.admin.updateUserById(customerId, {
    password,
  });
  if (updateError) {
    console.error("setStaffCustomerPassword failed:", updateError.message);
    return { error: "server" };
  }
  return { ok: true };
}

const CREATED_PROFILE_SELECT =
  "id, email, first_name, last_name, phone, preferred_contact, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship";

function isDuplicateAuthEmail(message: string) {
  return /already been registered|already exists|email address is already/i.test(
    message,
  );
}

function emailLookupPattern(email: string) {
  return email.replace(/[%_\\]/g, "\\$&");
}

function filePlaceholderEmail() {
  return `file.${randomUUID()}@customers.k9atelier.com`;
}

function profileUpdateRow(input: StaffCustomerCreateInput, email?: string) {
  return {
    ...(email ? { email } : {}),
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    preferred_contact: input.preferredContact,
    emergency_contact_name: input.emergencyContactName,
    emergency_contact_phone: input.emergencyContactPhone,
    emergency_contact_relationship: input.emergencyContactRelationship,
  };
}

async function emailAlreadyUsed(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  exceptUserId?: string,
) {
  let query = admin
    .from("profiles")
    .select("id")
    .ilike("email", emailLookupPattern(email))
    .limit(1);
  if (exceptUserId) query = query.neq("id", exceptUserId);
  const { data, error } = await query;
  if (error) {
    console.error("createStaffCustomer email lookup failed:", error.message);
    return { error: "server" as const };
  }
  if ((data ?? []).length > 0) {
    return {
      error: "conflict" as const,
      message: "That email is already used by another account.",
    };
  }
  return null;
}

async function insertOptionalPet(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  pet: OptionalStaffPetInput,
  actorUserId: string,
) {
  const { data, error } = await admin
    .from("pets")
    .insert({
      customer_id: customerId,
      name: pet.name,
      breed: pet.breed,
      weight_lbs: pet.weightLbs,
      date_of_birth: pet.dateOfBirth,
      approximate_age_years: pet.approximateAgeYears,
      sex: pet.sex,
      temperament_notes: pet.temperamentNotes,
      health_comfort_notes: pet.healthComfortNotes,
      grooming_preferences: pet.groomingPreferences,
      rabies_status: pet.rabiesStatus,
      rabies_expiration_date: pet.rabiesExpirationDate,
    })
    .select(PET_SELECT)
    .single();
  if (error || !data) {
    console.error("createStaffCustomer pet insert failed:", error?.message);
    return null;
  }

  if (pet.adminServiceNotes) {
    const { error: notesError } = await admin.from("pet_admin_notes").insert({
      pet_id: data.id,
      notes: pet.adminServiceNotes,
      updated_by: actorUserId,
    });
    if (notesError) {
      console.error("createStaffCustomer pet notes failed:", notesError.message);
    }
  }

  try {
    const { ensurePetReferralCode } = await import("@/lib/referrals/service");
    await ensurePetReferralCode({
      petId: data.id,
      petName: pet.name,
      ownerCustomerId: customerId,
    });
  } catch (referralError) {
    console.error("createStaffCustomer referral code failed:", referralError);
  }

  return {
    ...mapPetRowToRecord(data as PetRow),
    adminServiceNotes: pet.adminServiceNotes,
  };
}

async function rollbackCreatedUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("createStaffCustomer rollback failed:", error.message);
  }
}

export async function createStaffCustomer(
  input: StaffCustomerCreateInput,
): Promise<
  | { customer: StaffCustomerRecord }
  | {
      error: "unauthenticated" | "forbidden" | "conflict" | "not_found" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const actorIsOwner = isOwnerEmail(session.user.email);

  if (input.email) {
    const staffEmails = await listProtectedStaffEmails(admin);
    if (isAdminAccountEmail(input.email, staffEmails)) {
      return {
        error: "conflict",
        message: "That email belongs to a staff account.",
      };
    }
    const taken = await emailAlreadyUsed(
      admin,
      input.email,
      input.customerId ?? undefined,
    );
    if (taken) return taken;
  }

  if (input.customerId) {
    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select(CREATED_PROFILE_SELECT)
      .eq("id", input.customerId)
      .maybeSingle();
    if (existingError) {
      console.error("createStaffCustomer lookup failed:", existingError.message);
      return { error: "server" };
    }
    if (!existing) return { error: "not_found" };

    if (input.email && normalizeStaffEmail(input.email) !== normalizeStaffEmail(existing.email)) {
      const { error: authError } = await admin.auth.admin.updateUserById(input.customerId, {
        email: input.email,
        email_confirm: true,
        ...(input.password ? { password: input.password } : {}),
      });
      if (authError) {
        console.error("createStaffCustomer auth update failed:", authError.message);
        if (isDuplicateAuthEmail(authError.message)) {
          return {
            error: "conflict",
            message: "That email is already used by another account.",
          };
        }
        return { error: "server" };
      }
    } else if (input.password) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(
        input.customerId,
        { password: input.password },
      );
      if (passwordError) {
        console.error("createStaffCustomer password failed:", passwordError.message);
        return { error: "server" };
      }
    }

    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .update(profileUpdateRow(input, input.email ?? undefined))
      .eq("id", input.customerId)
      .select(CREATED_PROFILE_SELECT)
      .maybeSingle();
    if (profileError || !profileRow) {
      console.error(
        "createStaffCustomer profile update failed:",
        profileError?.message ?? "profile row missing",
      );
      return { error: "server" };
    }

    const pets: StaffCustomerRecord["pets"] = [];
    if (input.pet) {
      const inserted = await insertOptionalPet(
        admin,
        input.customerId,
        input.pet,
        session.user.id,
      );
      if (!inserted) return { error: "server" };
      pets.push(inserted);
    }

    const actionInput = {
      actorIsOwner,
      actorUserId: session.user.id,
      targetUserId: input.customerId,
      targetEmail: profileRow.email,
    };
    return {
      customer: {
        profile: mapProfileRow(profileRow as CustomerProfileRow),
        pets,
        paymentMethods: [],
        kind: "customer",
        frozen: false,
        canDelete: !ownerAccountActionBlockReason({
          ...actionInput,
          action: "delete",
        }),
        canFreeze: !ownerAccountActionBlockReason({
          ...actionInput,
          action: "freeze",
        }),
      },
    };
  }

  const email = input.email ?? filePlaceholderEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(input.password ? { password: input.password } : {}),
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    },
    app_metadata: {
      staff_created: true,
      unclaimed: !input.password,
      file_placeholder_email: !input.email,
    },
  });
  if (error || !data.user) {
    console.error("createStaffCustomer createUser failed:", error?.message);
    if (error && isDuplicateAuthEmail(error.message)) {
      return {
        error: "conflict",
        message: "That email is already used by another account.",
      };
    }
    return { error: "server" };
  }

  const userId = data.user.id;
  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .update(profileUpdateRow(input, email))
    .eq("id", userId)
    .select(CREATED_PROFILE_SELECT)
    .maybeSingle();

  if (profileError || !profileRow) {
    console.error(
      "createStaffCustomer profile update failed:",
      profileError?.message ?? "profile row missing",
    );
    await rollbackCreatedUser(admin, userId);
    return { error: "server" };
  }

  const pets: StaffCustomerRecord["pets"] = [];
  if (input.pet) {
    const inserted = await insertOptionalPet(admin, userId, input.pet, session.user.id);
    if (!inserted) {
      await rollbackCreatedUser(admin, userId);
      return { error: "server" };
    }
    pets.push(inserted);
  }

  const actionInput = {
    actorIsOwner,
    actorUserId: session.user.id,
    targetUserId: userId,
    targetEmail: email,
  };

  return {
    customer: {
      profile: mapProfileRow(profileRow as CustomerProfileRow),
      pets,
      paymentMethods: [],
      kind: "customer",
      frozen: false,
      canDelete: !ownerAccountActionBlockReason({
        ...actionInput,
        action: "delete",
      }),
      canFreeze: !ownerAccountActionBlockReason({
        ...actionInput,
        action: "freeze",
      }),
    },
  };
}
