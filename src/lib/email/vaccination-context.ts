import { createClient } from "@/lib/supabase/server";

type VaccinationNotificationContext = {
  petName: string;
  customerEmail: string;
  customerName: string | null;
  expirationDate: string | null;
};

type VaccinationRow = {
  expiration_date: string | null;
  pets: { name: string } | { name: string }[] | null;
  profiles: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | {
    email: string;
    first_name: string | null;
    last_name: string | null;
  }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function fetchVaccinationNotificationContext(
  recordId: string,
): Promise<VaccinationNotificationContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pet_vaccination_records")
    .select(
      `
      expiration_date,
      pets ( name ),
      profiles ( email, first_name, last_name )
    `,
    )
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    console.error("fetchVaccinationNotificationContext failed:", error.message);
    return null;
  }

  if (!data) return null;

  const row = data as VaccinationRow;
  const pet = firstRelation(row.pets);
  const profile = firstRelation(row.profiles);
  const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean);

  if (!profile?.email) return null;

  return {
    petName: pet?.name ?? "your pet",
    customerEmail: profile.email,
    customerName: nameParts.length > 0 ? nameParts.join(" ") : null,
    expirationDate: row.expiration_date,
  };
}
