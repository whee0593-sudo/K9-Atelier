import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { contactFromAdminAppointment } from "@/lib/email/appointment-context";
import { sendAppointmentConfirmRequestSms } from "@/lib/sms/appointment-sms";
import {
  addDaysToIsoDate,
  hourInBusinessTimezone,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";
import { isSmsConfigured } from "@/lib/sms/twilio";

const REMINDER_SELECT = `
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
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  created_at,
  reminder_sms_sent_at,
  en_route_sms_sent_at,
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

export type ReminderRunResult = {
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
};

const CONFIRM_REQUEST_LEAD_DAYS = 3;

export async function sendThreeDayConfirmRequestSms(): Promise<ReminderRunResult> {
  if (hourInBusinessTimezone() !== 10) {
    return { sent: 0, skipped: 0, failed: 0, reason: "outside_10am_window" };
  }
  if (!isSmsConfigured()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "sms_not_configured" };
  }
  if (!hasSupabaseAdminConfig()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "supabase_admin_missing" };
  }

  const admin = createAdminClient();
  const targetDate = addDaysToIsoDate(
    todayInBusinessTimezone(),
    CONFIRM_REQUEST_LEAD_DAYS,
  );
  const { data, error } = await admin
    .from("appointments")
    .select(REMINDER_SELECT)
    .eq("status", "confirmed")
    .eq("appointment_date", targetDate)
    .is("reminder_sms_sent_at", null);

  if (error) {
    console.error("sendThreeDayConfirmRequestSms lookup failed:", error.message);
    return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (data ?? []) as unknown as AppointmentRow[]) {
    const appointment = mapAppointmentRowToAdminRecord(row);
    const contact = contactFromAdminAppointment(appointment);
    if (!contact?.phone) {
      skipped += 1;
      continue;
    }

    const ok = await sendAppointmentConfirmRequestSms(appointment, contact);
    if (!ok) {
      failed += 1;
      continue;
    }

    const { error: markError } = await admin
      .from("appointments")
      .update({ reminder_sms_sent_at: new Date().toISOString() })
      .eq("id", appointment.id);

    if (markError) {
      console.error(
        "sendThreeDayConfirmRequestSms mark failed:",
        appointment.id,
        markError.message,
      );
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return { sent, skipped, failed };
}
