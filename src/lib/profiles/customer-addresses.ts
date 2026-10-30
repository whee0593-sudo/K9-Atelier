import { createAuthenticatedSupabaseClient, requireAuthenticatedUser } from "@/lib/pets/auth";
import type { ServiceAddress } from "@/lib/travel";

export type SavedServiceAddress = ServiceAddress & { id: string };
const SELECT = "id, street, city, state, zip";

export async function listOwnServiceAddresses(): Promise<{ addresses: SavedServiceAddress[] } | { error: "unauthenticated" | "server" }> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" as const };
  const db = await createAuthenticatedSupabaseClient();
  const { data, error } = await db.from("customer_service_addresses")
    .select(SELECT).eq("customer_id", user.id).order("created_at", { ascending: true });
  if (error) return { error: "server" as const };
  return { addresses: (data ?? []) as SavedServiceAddress[] };
}

export async function saveOwnServiceAddress(address: ServiceAddress, id?: string): Promise<{ address: SavedServiceAddress } | { error: "unauthenticated" | "server" | "conflict" | "not_found" }> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" as const };
  const db = await createAuthenticatedSupabaseClient();
  const query = id
    ? db.from("customer_service_addresses").update({ ...address, address_lat: null, address_lon: null })
        .eq("id", id).eq("customer_id", user.id)
    : db.from("customer_service_addresses").insert({ ...address, customer_id: user.id });
  const { data, error } = await query.select(SELECT).maybeSingle();
  if (error) return { error: error.code === "23505" ? "conflict" as const : "server" as const };
  if (!data) return { error: "not_found" as const };
  return { address: data as SavedServiceAddress };
}

export async function deleteOwnServiceAddress(id: string): Promise<{ ok: true } | { error: "unauthenticated" | "server" | "not_found" }> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };
  const db = await createAuthenticatedSupabaseClient();
  const { data, error } = await db.from("customer_service_addresses").delete()
    .eq("id", id).eq("customer_id", user.id).select("id").maybeSingle();
  if (error) return { error: "server" };
  if (!data) return { error: "not_found" };
  return { ok: true };
}
