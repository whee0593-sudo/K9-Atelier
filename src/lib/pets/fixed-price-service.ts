import { getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFixedServicePrice, mapFixedServicePrices, type FixedServicePrices } from "./fixed-prices";

export async function saveStaffPetServicePrice(customerId: string, petId: string, input: unknown): Promise<
  { fixedServicePrices: FixedServicePrices } | {error:"unauthenticated"|"forbidden"|"not_found"|"server"|"invalid"}
> {
  const session = await getStaffSession();
  if ("error" in session) return session;
  const price = parseFixedServicePrice(input);
  if (!price) return { error: "invalid" as const };
  const admin = createAdminClient();
  const pet = await admin.from("pets").select("id").eq("id",petId).eq("customer_id",customerId).is("archived_at",null).maybeSingle();
  if (pet.error) return {error:"server" as const};
  if (!pet.data) return {error:"not_found" as const};
  const saved = await admin.from("pet_service_prices").upsert({
    pet_id:petId,service_id:price.serviceId,amount:price.amount,updated_by:session.user.id,
  }, {onConflict:"pet_id,service_id"});
  if (saved.error) { console.error("saveStaffPetServicePrice failed:",saved.error.message); return {error:"server" as const}; }
  const rows = await admin.from("pet_service_prices").select("service_id,amount").eq("pet_id",petId);
  if (rows.error) return {error:"server" as const};
  return {fixedServicePrices:mapFixedServicePrices(rows.data)};
}
