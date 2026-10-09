import { estimateServiceDurationMinutes } from "@/lib/services";
import { groupBlocksByDate } from "@/lib/appointments/availability-blocks";
import { loadAvailabilityBlocks } from "@/lib/appointments/availability-block-store";
import {
  assertVisitScheduleAllowed,
  getAvailabilityForAddress,
  getBaseGeoPoint,
  loadDayClosures,
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
import { replaceVisitSchedule } from "@/lib/visits/persist";
import { resolveAppointmentDuration } from "@/lib/visits/duration";
import {
  hasVisitSequence,
  listVisitArrivalMinutes,
  scheduleVisitPetChain,
  visitSpanFitsScheduleBounds,
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
  visit_sequence,
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

function visitDurationDecision(row: LoadedAppointment) {
  const pet = firstRelation(row.pets);
  return resolveAppointmentDuration({
    storedMinutes: row.estimated_duration_minutes,
    status: row.status,
    appointmentDate: row.appointment_date,
    serviceEndedAt: row.service_ended_at,
    liveEstimateMinutes: estimateServiceDurationMinutes(
      row.service_id,
      pet?.weight_lbs ?? 20,
      row.add_on_ids ?? [],
    ),
  });
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
  const visitRows = [...(await loadActiveVisitRows(loaded.row))].sort(
    (left, right) => (left.visit_sequence ?? 0) - (right.visit_sequence ?? 0),
  );
  if (visitRows.some((row) => !hasVisitSequence(row.visit_sequence))) {
    return { error: "conflict" };
  }
  const visitAppointmentIds = visitRows.map((row) => row.id);
  const decisions = visitRows.map(visitDurationDecision);
  if (decisions.some((decision) => decision.unknown || decision.minutes == null)) {
    return { error: "conflict" };
  }
  const durations = decisions.map((decision) => decision.minutes ?? 0);
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
        visitSpanFitsScheduleBounds({
          visitStartMinutes: start,
          durations,
          closure,
          blocks: dayBlocks,
        }).ok,
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
        durationMinutes: visitDurationDecision(row).minutes ?? 0,
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
    (left, right) => (left.visit_sequence ?? 0) - (right.visit_sequence ?? 0),
  );
  if (ordered.some((row) => !hasVisitSequence(row.visit_sequence))) {
    return { error: "conflict" };
  }
  const anchor = ordered[0] ?? loaded.row;
  const visitAppointmentIds = ordered.map((row) => row.id);
  const decisions = ordered.map(visitDurationDecision);
  if (decisions.some((decision) => decision.unknown || decision.minutes == null)) {
    return { error: "conflict" };
  }
  const durations = decisions.map((decision) => decision.minutes ?? 0);
  const completed = ordered.some(isCompletedVisit);
  const planned = scheduleVisitPetChain({
    visitStartMinutes: parsed.slotStartMinutes,
    durations,
  });
  if (!planned.ok) return { error: "slot_unavailable" };
  const slots = planned.slots;

  if (!completed) {
    const point = visitPoint(anchor);
    if (!point) return { error: "conflict" };
    const allowed = await assertVisitScheduleAllowed({
      date: parsed.date,
      visitStartMinutes: parsed.slotStartMinutes,
      durations,
      excludeAppointmentIds: visitAppointmentIds,
      enforceZoneAndCapacity: true,
      point,
      zip: anchor.address_zip,
    });
    if ("error" in allowed) return allowed;
  }

  const visitId = ordered[0]?.visit_id;
  if (!visitId) return { error: "server" };
  const written = await replaceVisitSchedule({
    visitId,
    serviceDate: parsed.date,
    visitStartMinutes: slots[0]!.scheduledStart,
    timePreference: slots[0]!.usedPreference,
    children: ordered.map((row, index) => {
      const slot = slots[index]!;
      return {
        id: row.id,
        scheduledStart: slot.scheduledStart,
        durationMinutes: slot.durationMinutes,
        appointmentTime: slot.appointmentTime,
        timePreference: slot.usedPreference,
      };
    }),
  });
  if ("error" in written) return written;

  const admin = createAdminClient();

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
            appointmentIds: ordered.map((row) => row.id),
            petIds: ordered.map((row) => row.pet_id),
            visitId: ordered[0]?.visit_id ?? appointment.visitId ?? null,
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
    .order("visit_sequence", { ascending: true });
  if (error || !data?.length) {
    if (error) console.error("loadActiveVisitRows failed:", error.message);
    return [row];
  }
  return data as unknown as LoadedAppointment[];
}
