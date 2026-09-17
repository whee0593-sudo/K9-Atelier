import { estimateServiceDurationMinutes } from "@/lib/services";
import {
  assignArrivalWindow,
  getAvailabilityForAddress,
  getBaseGeoPoint,
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
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  return { ok: true };
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
  if (row.service_started_at || row.service_ended_at) return { error: "conflict" };
  if (
    row.status !== "confirmed" &&
    row.status !== "pending_confirmation"
  ) {
    return { error: "conflict" };
  }
  return null;
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

  const point = visitPoint(loaded.row);
  if (!point) return { error: "conflict" };

  const base = await getBaseGeoPoint();
  if (!base) return { error: "misconfigured" };

  const today = todayInBusinessTimezone();
  const extraDates =
    today && isBookableWeekday(parseDateValue(today)) ? [today] : [];
  const result = await getAvailabilityForAddress({
    point,
    zip: loaded.row.address_zip,
    durationMinutes: visitDurationMinutes(loaded.row),
    base,
    excludeAppointmentIds: [appointmentId],
    extraDates,
  });
  if ("error" in result) return result;
  return { days: result.days };
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

  const point = visitPoint(loaded.row);
  if (!point) return { error: "conflict" };

  const base = await getBaseGeoPoint();
  if (!base) return { error: "misconfigured" };

  const assignment = await assignArrivalWindow({
    date: parsed.date,
    point,
    zip: loaded.row.address_zip,
    durationMinutes: visitDurationMinutes(loaded.row),
    slotStartMinutes: parsed.slotStartMinutes,
    base,
    excludeAppointmentIds: [appointmentId],
    allowUnbookableDate: true,
  });
  if ("error" in assignment) return assignment;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .update({
      appointment_date: parsed.date,
      appointment_time: assignment.insertion.appointmentTime,
      scheduled_start: assignment.insertion.scheduledStart,
      time_preference: assignment.insertion.usedPreference,
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
  const contact: CustomerContact | null = contactFromAdminAppointment(appointment);
  if (contact) {
    try {
      await notifyCustomerAppointmentChange("reschedule", appointment, contact, {
        fee: 0,
      });
    } catch (emailError) {
      console.error("staff reschedule email failed:", emailError);
    }
  }

  return { appointment };
}
