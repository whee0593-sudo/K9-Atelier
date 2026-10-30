import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapProfileRow,
  type CustomerProfile,
  type CustomerProfileRow,
  type CustomerProfileWriteInput,
} from "@/lib/profiles/types";

const PROFILE_SELECT =
  "id, email, first_name, last_name, phone, birthday, preferred_contact, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, household_allergy_status, household_allergy_details";

function toUpdateRow(input: CustomerProfileWriteInput) {
  const row: Record<string, string | null> = {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone || null,
    ...(input.birthday !== undefined ? { birthday: input.birthday } : {}),
    preferred_contact: input.preferredContact,
    emergency_contact_name: input.emergencyContactName,
    emergency_contact_phone: input.emergencyContactPhone,
    emergency_contact_relationship: input.emergencyContactRelationship,
  };
  if (input.householdAllergyStatus !== undefined) {
    row.household_allergy_status = input.householdAllergyStatus;
    row.household_allergy_details =
      input.householdAllergyStatus === "yes"
        ? input.householdAllergyDetails ?? null
        : null;
  }
  return row;
}

export async function getOwnProfile(): Promise<
  { profile: CustomerProfile } | { error: "unauthenticated" | "not_found" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getOwnProfile failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };
  return { profile: mapProfileRow(data as CustomerProfileRow) };
}

export async function updateOwnProfile(
  input: CustomerProfileWriteInput,
): Promise<
  { profile: CustomerProfile } | { error: "unauthenticated" | "not_found" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(toUpdateRow(input))
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("updateOwnProfile failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };
  return { profile: mapProfileRow(data as CustomerProfileRow) };
}

/** Save only edited customer fields; email changes require Auth verification. */
export async function updateOwnProfilePatch(input: Partial<CustomerProfileWriteInput>): Promise<{ profile: CustomerProfile; message?: string } | { error: "unauthenticated" | "server" | "not_found" | "email_update"; message?: string }> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" as const };
  const db = await createAuthenticatedSupabaseClient();
  const columns = {
    firstName: "first_name", lastName: "last_name", phone: "phone", birthday: "birthday",
    preferredContact: "preferred_contact", emergencyContactName: "emergency_contact_name",
    emergencyContactPhone: "emergency_contact_phone", emergencyContactRelationship: "emergency_contact_relationship",
    householdAllergyStatus: "household_allergy_status", householdAllergyDetails: "household_allergy_details",
  } as const;
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(columns)) {
    if (Object.hasOwn(input, key)) row[column] = input[key as keyof CustomerProfileWriteInput];
  }
  if (Object.hasOwn(input, "householdAllergyStatus") && input.householdAllergyStatus !== "yes") row.household_allergy_details = null;
  if (Object.keys(row).length) {
    const { data, error } = await db.from("profiles").update(row).eq("id", user.id).select("id").maybeSingle();
    if (error) return { error: "server" as const };
    if (!data) return { error: "not_found" as const };
  }
  let message: string | undefined;
  if (input.email && input.email !== user.email) {
    if (input.email !== user.new_email) {
      const { error } = await db.auth.updateUser({ email: input.email });
      if (error) return { error: "email_update" as const, message: error.message };
    }
    message = "Check your email to confirm the email address change. Your login email updates after confirmation.";
  }
  const result = await getOwnProfile();
  return "error" in result ? result : { ...result, message };
}

function isDuplicateAuthEmail(message: string) {
  return /already been registered|already exists|email address is already/i.test(
    message,
  );
}

export async function updateStaffCustomerProfile(
  customerId: string,
  input: CustomerProfileWriteInput,
): Promise<
  | { profile: CustomerProfile }
  | {
      error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const nextEmail = input.email?.trim().toLowerCase();

  if (nextEmail) {
    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", nextEmail)
      .neq("id", customerId)
      .maybeSingle();
    if (existingError) {
      console.error(
        "updateStaffCustomerProfile email lookup failed:",
        existingError.message,
      );
      return { error: "server" };
    }
    if (existing) {
      return {
        error: "conflict",
        message: "That email is already used by another account.",
      };
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      customerId,
      {
        email: nextEmail,
        email_confirm: true,
      },
    );
    if (authError) {
      console.error("updateStaffCustomerProfile auth email failed:", authError.message);
      if (isDuplicateAuthEmail(authError.message)) {
        return {
          error: "conflict",
          message: "That email is already used by another account.",
        };
      }
      return { error: "server" };
    }
  }

  const updateRow = {
    ...toUpdateRow(input),
    ...(nextEmail ? { email: nextEmail } : {}),
  };
  const { data, error } = await admin
    .from("profiles")
    .update(updateRow)
    .eq("id", customerId)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("updateStaffCustomerProfile failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };
  return { profile: mapProfileRow(data as CustomerProfileRow) };
}
