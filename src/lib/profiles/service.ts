import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { getStaffSession } from "@/lib/staff/auth";
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

export async function updateStaffCustomerProfile(
  customerId: string,
  input: CustomerProfileWriteInput,
): Promise<
  | { profile: CustomerProfile }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(toUpdateRow(input))
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
