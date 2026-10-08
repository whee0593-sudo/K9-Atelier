import { estimateServiceDurationMinutes } from "@/lib/services";
import { groupBlocksByDate } from "@/lib/appointments/availability-blocks";
import { loadAvailabilityBlocks } from "@/lib/appointments/availability-block-store";
import {
  listStaffRescheduleDates,
  staffClockStartBlocked,
  staffOpenClockStarts,
} from "@/lib/appointments/staff-clock-window";
import { loadDayClosures } from "@/lib/appointments/schedule";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type {
  AdminAppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import {
  formatArrivalWindow,
  preferenceFromStart,
} from "@/lib/booking-schedule";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { parseStaffRescheduleInput } from "@/lib/appointments/staff-reschedule-input";
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

function visitDurationMinutes(row: LoadedAppointment): number {
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

function scheduleFromSlot(slotStartMinutes: number, durationMinutes: number) {
  return {
    appointmentTime: formatArrivalWindow(slotStartMinutes, durationMinutes),
    scheduledStart: slotStartMinutes,
    timePreference: preferenceFromStart(slotStartMinutes),
  };
}

export async function listStaffAppointmentAvailability(
  appointmentId: string,
): Promise<
  | {
      days: Array<{ date: string; available: boolean; slots: number[] }>;
    }
  | { error: StaffRescheduleError }
> {
  const session = await requireStaffSession();
  if ("error" in session) return session;

  const loaded = await loadAppointmentRow(appointmentId);
  if ("error" in loaded) return loaded;

  const blocked = assertOpenForReschedule(loaded.row);
  if (blocked) return blocked;

  const today = todayInBusinessTimezone();
  const dates = listStaffRescheduleDates(today, [loaded.row.appointment_date]);
  if (dates.length === 0) return { days: [] };

  const fromDate = dates[0]!;
  const toDate = dates[dates.length - 1]!;
  const [closuresResult, blocksResult] = await Promise.all([
    loadDayClosures(fromDate, toDate),
    loadAvailabilityBlocks(fromDate, toDate),
  ]);
  if ("error" in closuresResult) return { error: "server" };
  if ("error" in blocksResult) {
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }

  const blocksByDate = groupBlocksByDate(blocksResult.blocks);
  const durationMinutes = visitDurationMinutes(loaded.row);
  const days = dates.map((date) => {
    const open = staffOpenClockStarts(
      closuresResult.closures.get(date) ?? null,
      blocksByDate.get(date) ?? [],
      durationMinutes,
    );
    return { date, available: open.available, slots: open.slots };
  });
  return { days };
}

/** Closures and availability blocks still reject a start. Route fit does not. */
async function rejectBlockedClockWindow(
  date: string,
  slotStartMinutes: number,
  durationMinutes: number,
): Promise<{ error: StaffRescheduleError } | null> {
  const [closuresResult, blocksResult] = await Promise.all([
    loadDayClosures(date, date),
    loadAvailabilityBlocks(date, date),
  ]);
  if ("error" in closuresResult) return { error: "server" };
  if ("error" in blocksResult) {
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }
  if (
    staffClockStartBlocked(
      closuresResult.closures.get(date) ?? null,
      blocksResult.blocks,
      slotStartMinutes,
      durationMinutes,
    )
  ) {
    return { error: "slot_unavailable" };
  }
  return null;
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

  const durationMinutes = visitDurationMinutes(loaded.row);
  const completed = isCompletedVisit(loaded.row);
  const windowBlock = await rejectBlockedClockWindow(
    parsed.date,
    parsed.slotStartMinutes,
    durationMinutes,
  );
  if (windowBlock) return windowBlock;
  const nextSchedule = scheduleFromSlot(
    parsed.slotStartMinutes,
    durationMinutes,
  );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .update({
      appointment_date: parsed.date,
      appointment_time: nextSchedule.appointmentTime,
      scheduled_start: nextSchedule.scheduledStart,
      time_preference: nextSchedule.timePreference,
    })
    .eq("id", appointmentId)
    .select(STAFF_RESCHEDULE_SELECT)
    .single();

  if (error || !data) {
    console.error("rescheduleStaffAppointment failed:", error?.message);
    if (error?.code === "23505") return { error: "slot_unavailable" };
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
          { fee: 0 },
        );
      } catch (emailError) {
        console.error("staff reschedule email failed:", emailError);
      }
    }
  }

  return { appointment };
}
