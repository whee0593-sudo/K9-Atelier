import { formatMinutesLabel } from "@/lib/appointments/closures";
import type { AppointmentStatus } from "@/lib/appointments/types";
import { preferenceFromStart } from "@/lib/booking-schedule";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { scheduleActivePetsFromVisitArrival } from "@/lib/visits/visit";

type CompactRow = {
  id: string;
  status: AppointmentStatus;
  scheduled_start: number | null;
  estimated_duration_minutes: number | null;
  service_id: string;
  add_on_ids: string[] | null;
  pets?:
    | { weight_lbs?: number | null }
    | { weight_lbs?: number | null }[]
    | null;
};

function firstPet(value: CompactRow["pets"]) {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Pull remaining dogs forward from the visit arrival so a cancelled dog
 * or a shorter service does not leave an empty gap.
 */
export async function compactVisitChildStarts(
  visitId: string,
): Promise<{ ok: true } | { error: "server" }> {
  if (!hasSupabaseAdminConfig()) return { ok: true };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, status, scheduled_start, estimated_duration_minutes, service_id, add_on_ids, pets ( weight_lbs )",
    )
    .eq("visit_id", visitId);

  if (error) {
    console.error("compactVisitChildStarts load failed:", error.message);
    return { error: "server" };
  }

  const pets = ((data ?? []) as CompactRow[]).map((row) => {
    const pet = firstPet(row.pets);
    const stored = row.estimated_duration_minutes;
    const duration =
      typeof stored === "number" && stored > 0
        ? stored
        : estimateServiceDurationMinutes(
            row.service_id,
            pet?.weight_lbs ?? 20,
            row.add_on_ids ?? [],
          );
    return {
      id: row.id,
      status: row.status,
      estimatedDurationMinutes: duration,
      scheduledStart: row.scheduled_start,
    };
  });

  const plan = scheduleActivePetsFromVisitArrival(pets);
  if (!plan || plan.slots.length === 0) return { ok: true };

  const ids = plan.slots.map((slot) => slot.id);
  const { error: clearError } = await admin
    .from("appointments")
    .update({ scheduled_start: null })
    .in("id", ids);
  if (clearError) {
    console.error("compactVisitChildStarts clear failed:", clearError.message);
    return { error: "server" };
  }

  const arrival = formatMinutesLabel(plan.visitStartMinutes);
  const preference = preferenceFromStart(plan.visitStartMinutes);
  for (const slot of plan.slots) {
    const { error: updateError } = await admin
      .from("appointments")
      .update({
        scheduled_start: slot.scheduledStart,
        appointment_time: arrival,
        time_preference: preference,
        estimated_duration_minutes: slot.durationMinutes,
      })
      .eq("id", slot.id);
    if (updateError) {
      console.error("compactVisitChildStarts update failed:", updateError.message);
      return { error: "server" };
    }
  }

  return { ok: true };
}
