import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { contactFromAdminAppointment } from "@/lib/email/appointment-context";
import { sendAppointmentReminderSms } from "@/lib/sms/appointment-sms";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
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

export async function sendTodaysAppointmentReminders(): Promise<ReminderRunResult> {
  if (!isSmsConfigured()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "sms_not_configured" };
  }
  if (!hasSupabaseAdminConfig()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "supabase_admin_missing" };
  }

  const admin = createAdminClient();
  const today = todayInBusinessTimezone();
  const { data, error } = await admin
    .from("appointments")
    .select(REMINDER_SELECT)
    .eq("status", "confirmed")
    .eq("appointment_date", today)
    .is("reminder_sms_sent_at", null);

  if (error) {
    console.error("sendTodaysAppointmentReminders lookup failed:", error.message);
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

    const ok = await sendAppointmentReminderSms(appointment, contact);
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
        "sendTodaysAppointmentReminders mark failed:",
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
