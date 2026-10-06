import { estimateServiceDurationMinutes } from "@/lib/services";
import {
  appointmentOverlapsBlocks,
  groupBlocksByDate,
} from "@/lib/appointments/availability-blocks";
import { loadAvailabilityBlocks } from "@/lib/appointments/availability-block-store";
import { isSlotClosed } from "@/lib/appointments/closures";
import {
  assignArrivalWindow,
  getAvailabilityForAddress,
  getBaseGeoPoint,
  loadDayClosures,
  loadOccupiedStops,
  loadOccupiedStopsByDate,
} from "@/lib/appointments/schedule";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type {
  AdminAppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import {
  isBookableWeekday,
  parseDateValue,
} from "@/lib/booking-slots";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { parseStaffRescheduleInput } from "@/lib/appointments/staff-reschedule-input";
import {
  listVisitArrivalMinutes,
  scheduleVisitPetChain,
  visitArrivalFits,
} from "@/lib/visits/visit";
import {
  contactFromAdminAppointment,
  type CustomerContact,
} from "@/lib/email/appointment-context";
import { notifyCustomerAppointmentChange } from "@/lib/email/appointment-mails";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

const STAFF_RESCHEDULE_SELECT = `
  id,
  customer_id,
  pet_id,
  service_id,
  service_name,
  add_on_ids,
  add_on_options,
  address_street,
  address_city,
  address_state,
  address_zip,
  travel_distance_miles,
  travel_fee,
  appointment_date,
  appointment_time,
  scheduled_start,
  time_preference,
  address_lat,
  address_lon,
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  staff_created,
  customer_confirm_token_hash,
  customer_confirm_expires_at,
  visit_id,
  service_price,
  estimated_duration_minutes,
  created_at,
  reminder_sms_sent_at,
  en_route_sms_sent_at,
  service_started_at,
  service_ended_at,
  pets ( name, breed, weight_lbs ),
  profiles ( email, first_name, last_name, phone )
`;

type StaffRescheduleError =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "slot_unavailable"
  | "misconfigured"
  | "server";

type LoadedAppointment = Omit<AppointmentRow, "pets"> & {
  address_lat?: number | null;
  address_lon?: number | null;
  pets?:
    | { name: string; breed: string; weight_lbs?: number }
    | { name: string; breed: string; weight_lbs?: number }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function requireStaffSession(): Promise<
  { ok: true } | { error: "unauthenticated" | "forbidden" }
> {
  try {
    const { getStaffSession } = await import("@/lib/staff/auth");
    const session = await getStaffSession();
    if ("error" in session) return { error: session.error };
    return { ok: true };
  } catch (error) {
    console.error("staff reschedule auth failed:", error);
    return { error: "unauthenticated" };
  }
}

async function loadAppointmentRow(
  appointmentId: string,
): Promise<{ row: LoadedAppointment } | { error: StaffRescheduleError }> {
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(STAFF_RESCHEDULE_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("loadStaffRescheduleAppointment failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };
  return { row: data as unknown as LoadedAppointment };
}

function visitPoint(row: LoadedAppointment): { lat: number; lon: number } | null {
  if (
    typeof row.address_lat !== "number" ||
    typeof row.address_lon !== "number"
  ) {
    return null;
  }
  return { lat: row.address_lat, lon: row.address_lon };
}

function visitDurationMinutes(row: LoadedAppointment): number {
  if (
    typeof row.estimated_duration_minutes === "number" &&
    row.estimated_duration_minutes > 0
  ) {
    return row.estimated_duration_minutes;
  }
  const pet = firstRelation(row.pets);
  return estimateServiceDurationMinutes(
    row.service_id,
    pet?.weight_lbs ?? 20,
    row.add_on_ids ?? [],
  );
}

function assertOpenForReschedule(
  row: LoadedAppointment,
): { error: StaffRescheduleError } | null {
  if (row.status === "cancelled") return { error: "conflict" };
  if (
    row.status !== "confirmed" &&
    row.status !== "pending_confirmation"
  ) {
    return { error: "conflict" };
  }
  return null;
}

function isCompletedVisit(row: LoadedAppointment) {
  return Boolean(row.service_started_at || row.service_ended_at);
}

export async function listStaffAppointmentAvailability(
  appointmentId: string,
): Promise<
  | {
      days: Array<{ date: string; available: boolean; slots: number[] }>;
      visit: {
        dogCount: number;
        estimatedDurationMinutes: number;
        dogs: Array<{
          petName: string;
          serviceName: string;
          durationMinutes: number;
        }>;
      };
    }
  | { error: StaffRescheduleError }
> {
  const session = await requireStaffSession();
  if ("error" in session) return session;

  const loaded = await loadAppointmentRow(appointmentId);
  if ("error" in loaded) return loaded;

  const blocked = assertOpenForReschedule(loaded.row);
  if (blocked) return blocked;

  const point = visitPoint(loaded.row);
  if (!point) return { error: "conflict" };

  const base = await getBaseGeoPoint();
  if (!base) return { error: "misconfigured" };

  const today = todayInBusinessTimezone();
  const extraDates = [today, loaded.row.appointment_date].filter(
    (date, index, all) =>
      Boolean(date) &&
      isBookableWeekday(parseDateValue(date)) &&
      all.indexOf(date) === index,
  );
  const visitRows = await loadActiveVisitRows(loaded.row);
  const visitAppointmentIds = visitRows.map((row) => row.id);
  const durations = visitRows.map(visitDurationMinutes);
  const totalDuration = durations.reduce((sum, minutes) => sum + minutes, 0);
  const result = await getAvailabilityForAddress({
    point,
    zip: loaded.row.address_zip,
    durationMinutes: 30,
    base,
    excludeAppointmentIds: visitAppointmentIds,
    extraDates,
  });
  if ("error" in result) return result;

  const dates = result.days.map((day) => day.date);
  const fromDate = dates[0];
  const toDate = dates[dates.length - 1];
  const [occupiedResult, closuresResult, blocksResult] = await Promise.all([
    fromDate && toDate
      ? loadOccupiedStopsByDate(fromDate, toDate, {
          excludeAppointmentIds: visitAppointmentIds,
        })
      : Promise.resolve({ byDate: new Map() }),
    fromDate && toDate
      ? loadDayClosures(fromDate, toDate)
      : Promise.resolve({ closures: new Map() }),
    fromDate && toDate
      ? loadAvailabilityBlocks(fromDate, toDate)
      : Promise.resolve({ blocks: [] }),
  ]);
  if ("error" in occupiedResult) return occupiedResult;
  if ("error" in closuresResult) return closuresResult;
  if ("error" in blocksResult) {
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }
  const blocksByDate = groupBlocksByDate(blocksResult.blocks);

  const days = result.days.map((day) => {
    if (!day.available && day.slots.length === 0) return day;
    const closure = closuresResult.closures.get(day.date) ?? null;
    const dayBlocks = blocksByDate.get(day.date) ?? [];
    if (closure?.closedAllDay || dayBlocks.some((block) => block.allDay)) {
      return { date: day.date, available: false, slots: [] as number[] };
    }
    const stops = occupiedResult.byDate.get(day.date)?.stops ?? [];
    const slots = listVisitArrivalMinutes({
      durations,
      otherStops: stops,
    }).filter(
      (start) =>
        !isSlotClosed(closure, start) &&
        !appointmentOverlapsBlocks(dayBlocks, start, totalDuration),
    );
    return { date: day.date, available: slots.length > 0, slots };
  });

  return {
    days,
    visit: {
      dogCount: visitRows.length,
      estimatedDurationMinutes: totalDuration,
      dogs: visitRows.map((row) => ({
        petName: firstRelation(row.pets)?.name ?? "Dog",
        serviceName: row.service_name,
        durationMinutes: visitDurationMinutes(row),
      })),
    },
  };
}

export async function rescheduleStaffAppointment(
  appointmentId: string,
  date: string,
  slotStartMinutes: number,
): Promise<
  | { appointment: AdminAppointmentRecord }
  | { error: StaffRescheduleError }
> {
  const session = await requireStaffSession();
  if ("error" in session) return session;

  const parsed = parseStaffRescheduleInput({ date, slotStartMinutes });
  if ("error" in parsed) return { error: "conflict" };

  const loaded = await loadAppointmentRow(appointmentId);
  if ("error" in loaded) return loaded;

  const blocked = assertOpenForReschedule(loaded.row);
  if (blocked) return blocked;

  const ordered = [...(await loadActiveVisitRows(loaded.row))].sort(
    (left, right) =>
      (left.scheduled_start ?? 0) - (right.scheduled_start ?? 0) ||
      left.created_at.localeCompare(right.created_at),
  );
  const anchor = ordered[0] ?? loaded.row;
  const visitAppointmentIds = ordered.map((row) => row.id);
  const durations = ordered.map(visitDurationMinutes);
  const totalDuration = durations.reduce((sum, minutes) => sum + minutes, 0);
  const completed = ordered.some(isCompletedVisit);
  const planned = scheduleVisitPetChain({
    visitStartMinutes: parsed.slotStartMinutes,
    durations,
  });
  if (!planned.ok) return { error: "slot_unavailable" };
  let slots = planned.slots;

  if (!completed) {
    const point = visitPoint(anchor);
    if (!point) return { error: "conflict" };
    const base = await getBaseGeoPoint();
    const assignment = base
      ? await assignArrivalWindow({
          date: parsed.date,
          point,
          zip: anchor.address_zip,
          durationMinutes: totalDuration,
          slotStartMinutes: parsed.slotStartMinutes,
          base,
          excludeAppointmentIds: visitAppointmentIds,
          allowUnbookableDate: true,
          allowUnfittedStart: true,
        })
      : { error: "misconfigured" as const };
    if ("error" in assignment) {
      return {
        error: assignment.error === "slot_unavailable" ? "slot_unavailable" : assignment.error,
      };
    }

    const [occupied, blocksResult] = await Promise.all([
      loadOccupiedStops(parsed.date, {
        excludeAppointmentIds: visitAppointmentIds,
      }),
      loadAvailabilityBlocks(parsed.date, parsed.date),
    ]);
    if ("error" in occupied) return occupied;
    if ("error" in blocksResult) {
      return {
        error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
      };
    }
    if (
      appointmentOverlapsBlocks(
        blocksResult.blocks,
        parsed.slotStartMinutes,
        totalDuration,
      ) ||
      !visitArrivalFits({
        visitStartMinutes: parsed.slotStartMinutes,
        durations,
        otherStops: occupied.stops,
      })
    ) {
      return { error: "slot_unavailable" };
    }
    slots = planned.slots;
  }

  const admin = createAdminClient();
  const { error: clearError } = await admin
    .from("appointments")
    .update({ scheduled_start: null })
    .in("id", visitAppointmentIds);
  if (clearError) {
    console.error("rescheduleStaffAppointment clear failed:", clearError.message);
    return { error: "server" };
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index]!;
    const slot = slots[index]!;
    const { error } = await admin
      .from("appointments")
      .update({
        appointment_date: parsed.date,
        appointment_time: slot.appointmentTime,
        scheduled_start: slot.scheduledStart,
        time_preference: slot.usedPreference,
      })
      .eq("id", row.id);
    if (error) {
      console.error("rescheduleStaffAppointment update failed:", error.message);
      for (const previous of ordered) {
        await admin
          .from("appointments")
          .update({
            appointment_date: previous.appointment_date,
            appointment_time: previous.appointment_time,
            scheduled_start: previous.scheduled_start,
            time_preference: previous.time_preference,
          })
          .eq("id", previous.id);
      }
      if (error.code === "23505") return { error: "slot_unavailable" };
      return { error: "server" };
    }
  }

  const { data, error } = await admin
    .from("appointments")
    .select(STAFF_RESCHEDULE_SELECT)
    .eq("id", appointmentId)
    .single();

  if (error || !data) {
    console.error("rescheduleStaffAppointment reload failed:", error?.message);
    return { error: "server" };
  }

  const appointment = mapAppointmentRowToAdminRecord(
    data as unknown as AppointmentRow,
  );
  if (!completed) {
    const contact: CustomerContact | null =
      contactFromAdminAppointment(appointment);
    if (contact) {
      try {
        await notifyCustomerAppointmentChange(
          "reschedule",
          appointment,
          contact,
          {
            fee: 0,
            petNames: ordered.map((row) => {
              const pet = firstRelation(row.pets);
              return pet?.name ?? "Dog";
            }),
          },
        );
      } catch (emailError) {
        console.error("staff reschedule email failed:", emailError);
      }
    }
  }

  return { appointment };
}

async function loadActiveVisitRows(row: LoadedAppointment) {
  if (!row.visit_id) return [row];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(STAFF_RESCHEDULE_SELECT)
    .eq("visit_id", row.visit_id)
    .neq("status", "cancelled")
    .order("scheduled_start", { ascending: true });
  if (error || !data?.length) {
    if (error) console.error("loadActiveVisitRows failed:", error.message);
    return [row];
  }
  return data as unknown as LoadedAppointment[];
}
