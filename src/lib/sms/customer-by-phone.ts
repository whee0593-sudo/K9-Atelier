import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { normalizePhoneToE164, phonesMatch } from "@/lib/sms/phone";

export type CustomerByPhone = {
  customerId: string;
  firstName: string;
  name: string;
  phone: string;
  petNames: string[];
};

function displayName(first: string | null, last: string | null, email: string) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email;
}

export async function lookupCustomerByPhone(
  from: string,
): Promise<CustomerByPhone | null> {
  if (!hasSupabaseAdminConfig()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, phone");

  if (error) {
    console.error("lookupCustomerByPhone failed:", error.message);
    return null;
  }

  const profile = (data ?? []).find((row) => phonesMatch(row.phone, from));
  if (!profile) return null;

  const { data: pets, error: petsError } = await admin
    .from("pets")
    .select("name")
    .eq("customer_id", profile.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (petsError) {
    console.error("lookupCustomerByPhone pets failed:", petsError.message);
  }

  const firstName =
    profile.first_name?.trim() ||
    displayName(profile.first_name, profile.last_name, profile.email).split(
      /\s+/,
    )[0];

  return {
    customerId: profile.id as string,
    firstName,
    name: displayName(profile.first_name, profile.last_name, profile.email),
    phone: normalizePhoneToE164(profile.phone ?? "") ?? from,
    petNames: (pets ?? [])
      .map((pet) => String(pet.name ?? "").trim())
      .filter(Boolean),
  };
}
