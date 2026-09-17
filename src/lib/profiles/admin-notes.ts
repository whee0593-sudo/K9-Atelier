import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";

export type CustomerAdminNotes = {
  notes: string;
  updatedAt: string | null;
};

export async function getStaffCustomerAdminNotes(
  customerId: string,
): Promise<
  | CustomerAdminNotes
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
    console.error("getStaffCustomerAdminNotes profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return { error: "not_found" };

  const { data, error } = await admin
    .from("customer_admin_notes")
    .select("notes, updated_at")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("getStaffCustomerAdminNotes failed:", error.message);
    return { error: "server" };
  }

  return {
    notes: data?.notes ?? "",
    updatedAt: data?.updated_at ?? null,
  };
}

export async function saveStaffCustomerAdminNotes(
  customerId: string,
  notes: string,
): Promise<
  | CustomerAdminNotes
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
    console.error("saveStaffCustomerAdminNotes profile failed:", profileError.message);
    return { error: "server" };
  }
  if (!profile) return { error: "not_found" };

  const { data, error } = await admin
    .from("customer_admin_notes")
    .upsert(
      {
        customer_id: customerId,
        notes,
        updated_by: session.user.id,
      },
      { onConflict: "customer_id" },
    )
    .select("notes, updated_at")
    .maybeSingle();

  if (error || !data) {
    console.error("saveStaffCustomerAdminNotes failed:", error?.message);
    return { error: "server" };
  }

  return {
    notes: data.notes ?? "",
    updatedAt: data.updated_at ?? null,
  };
}
