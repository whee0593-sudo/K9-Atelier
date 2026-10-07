import type { AppointmentStatus } from "@/lib/appointments/types";
import { preferenceFromStart } from "@/lib/booking-schedule";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { replaceVisitSchedule } from "@/lib/visits/persist";
import {
  scheduleActivePetsFromVisitArrival,
  visitArrivalFields,
} from "@/lib/visits/visit";

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

  const arrival = visitArrivalFields(plan.visitStartMinutes);
  const preference = preferenceFromStart(plan.visitStartMinutes);
  const written = await replaceVisitSchedule({
    visitId,
    serviceDate: null,
    visitStartMinutes: arrival.scheduledStart,
    timePreference: preference,
    children: plan.slots.map((slot) => ({
      id: slot.id,
      scheduledStart: slot.scheduledStart,
      durationMinutes: slot.durationMinutes,
      appointmentTime: arrival.appointmentTime,
      timePreference: preference,
    })),
  });
  if ("error" in written) return { error: "server" };
  return { ok: true };
}
