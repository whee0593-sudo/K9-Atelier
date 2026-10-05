import { phonesMatch } from "@/lib/sms/phone";
import { getStaffSession } from "@/lib/staff/auth";
import {
  isBookingCustomerId,
  mapBookingProfile,
  type BookingAddressStamp,
  type StaffBookingProfile,
} from "@/lib/staff/customer-booking-profile";
import { normalizeStaffEmail } from "@/lib/staff/owner";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

async function loadBookingProfile(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
): Promise<StaffBookingProfile | { error: "server" } | null> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, phone")
    .eq("id", customerId)
    .maybeSingle();

  if (profileError) {
    console.error("loadBookingProfile profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return null;

  const [petsResult, savedResult, visitResult] = await Promise.all([
    admin
      .from("pets")
      .select("id, name, breed, weight_lbs")
      .eq("customer_id", customerId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("customer_service_addresses")
      .select("street, city, state, zip, created_at")
      .eq("customer_id", customerId),
    admin
      .from("appointments")
      .select(
        "address_street, address_city, address_state, address_zip, created_at",
      )
      .eq("customer_id", customerId),
  ]);

  if (petsResult.error) {
    console.error("loadBookingProfile pets failed:", petsResult.error.message);
    return { error: "server" };
  }

  let savedAddresses: BookingAddressStamp[] = [];
  if (savedResult.error) {
    console.error(
      "loadBookingProfile saved addresses failed:",
      savedResult.error.message,
    );
  } else {
    savedAddresses = (savedResult.data ?? []).map((row) => ({
      street: String(row.street ?? ""),
      city: String(row.city ?? ""),
      state: String(row.state ?? ""),
      zip: String(row.zip ?? ""),
      createdAt: String(row.created_at ?? ""),
    }));
  }

  if (visitResult.error) {
    console.error(
      "loadBookingProfile visit addresses failed:",
      visitResult.error.message,
    );
    return { error: "server" };
  }

  const visitAddresses: BookingAddressStamp[] = (visitResult.data ?? []).map(
    (row) => ({
      street: String(row.address_street ?? ""),
      city: String(row.address_city ?? ""),
      state: String(row.address_state ?? ""),
      zip: String(row.address_zip ?? ""),
      createdAt: String(row.created_at ?? ""),
    }),
  );

  return mapBookingProfile({
    profile: {
      id: profile.id as string,
      email: profile.email as string | null,
      first_name: profile.first_name as string | null,
      last_name: profile.last_name as string | null,
      phone: profile.phone as string | null,
    },
    pets: (petsResult.data ?? []).map((pet) => ({
      id: pet.id as string,
      name: pet.name as string | null,
      breed: pet.breed as string | null,
      weight_lbs: pet.weight_lbs as number | string | null,
    })),
    savedAddresses,
    visitAddresses,
  });
}

export async function lookupStaffBookingProfile(query: {
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<
  | { profile: StaffBookingProfile | null }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const customerId = query.customerId?.trim() ?? "";
  if (customerId) {
    if (!isBookingCustomerId(customerId)) {
      return { profile: null };
    }
    const loaded = await loadBookingProfile(admin, customerId);
    if (loaded && "error" in loaded) return loaded;
    return { profile: loaded };
  }

  const email = query.email?.trim() ? normalizeStaffEmail(query.email) : "";
  if (email) {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", escapeIlike(email))
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("lookupStaffBookingProfile email failed:", error.message);
      return { error: "server" };
    }
    if (data?.id) {
      const loaded = await loadBookingProfile(admin, data.id as string);
      if (loaded && "error" in loaded) return loaded;
      return { profile: loaded };
    }
  }

  const phone = query.phone?.trim() ?? "";
  if (phone) {
    const { data, error } = await admin.from("profiles").select("id, phone");
    if (error) {
      console.error("lookupStaffBookingProfile phone failed:", error.message);
      return { error: "server" };
    }
    const match = (data ?? []).find((row) => phonesMatch(row.phone, phone));
    if (!match?.id) return { profile: null };
    const loaded = await loadBookingProfile(admin, match.id as string);
    if (loaded && "error" in loaded) return loaded;
    return { profile: loaded };
  }

  return { profile: null };
}
