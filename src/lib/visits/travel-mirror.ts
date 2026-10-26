import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

/** Reconcile compatibility fees, totals and stored lines in one transaction. */
export async function syncVisitTravelFeeMirror(
  visitId: string,
): Promise<{ ok: true } | { error: "server" }> {
  if (!hasSupabaseAdminConfig()) return { ok: true };
  const { error } = await createAdminClient().rpc("sync_visit_travel_fee", { p_visit_id: visitId });
  if (error) {
    console.error("syncVisitTravelFeeMirror failed:", error.code, error.message);
    return { error: "server" };
  }
  return { ok: true };
}
