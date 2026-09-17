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
  "id, email, first_name, last_name, phone, preferred_contact, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship";

function toUpdateRow(input: CustomerProfileWriteInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone || null,
    preferred_contact: input.preferredContact,
    emergency_contact_name: input.emergencyContactName,
    emergency_contact_phone: input.emergencyContactPhone,
    emergency_contact_relationship: input.emergencyContactRelationship,
  };
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
