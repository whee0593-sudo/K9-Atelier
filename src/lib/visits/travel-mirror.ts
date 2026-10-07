import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import type { AppointmentStatus } from "@/lib/appointments/types";
import { planTravelFeeMirror } from "@/lib/visits/visit";

/**
 * Copy visits.travel_fee onto one active pet appointment and clear the rest.
 * The visit row remains the source of truth.
 */
export async function syncVisitTravelFeeMirror(
  visitId: string,
): Promise<{ ok: true } | { error: "server" }> {
  if (!hasSupabaseAdminConfig()) return { ok: true };
  const admin = createAdminClient();
  const { data: visit, error: visitError } = await admin
    .from("visits")
    .select("id, travel_fee")
    .eq("id", visitId)
    .maybeSingle();
  if (visitError || !visit) {
    console.error(
      "syncVisitTravelFeeMirror visit load failed:",
      visitError?.message,
    );
    return { error: "server" };
  }

  const { data, error } = await admin
    .from("appointments")
    .select("id, status, travel_fee, scheduled_start")
    .eq("visit_id", visitId);
  if (error) {
    console.error("syncVisitTravelFeeMirror appointment load failed:", error.message);
    return { error: "server" };
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    status: row.status as AppointmentStatus,
    travelFee: Number(row.travel_fee ?? 0),
    scheduledStart:
      typeof row.scheduled_start === "number" ? row.scheduled_start : null,
  }));
  const plan = planTravelFeeMirror(rows, Number(visit.travel_fee ?? 0));
  const current = new Map(rows.map((row) => [row.id, row.travelFee]));

  for (const item of plan) {
    if (current.get(item.id) === item.travelFee) continue;
    const { error: updateError } = await admin
      .from("appointments")
      .update({ travel_fee: item.travelFee })
      .eq("id", item.id);
    if (updateError) {
      console.error(
        "syncVisitTravelFeeMirror update failed:",
        item.id,
        updateError.message,
      );
      return { error: "server" };
    }
  }

  return { ok: true };
}
