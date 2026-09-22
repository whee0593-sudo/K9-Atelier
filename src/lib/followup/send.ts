import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
} from "@/lib/followup/copy";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  hourInBusinessTimezone,
  yesterdayInBusinessTimezone,
} from "@/lib/sms/schedule";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

const FOLLOW_UP_SELECT = `
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
  service_started_at,
  service_ended_at,
  followup_sent_at,
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

export type FollowUpRunResult = {
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
};

export async function sendNextDayFollowUp(
  now = new Date(),
): Promise<FollowUpRunResult> {
  if (hourInBusinessTimezone(now) !== 10) {
    return { sent: 0, skipped: 0, failed: 0, reason: "outside_10am_window" };
  }
  if (!isEmailConfigured() && !isSmsConfigured()) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      reason: "notifications_not_configured",
    };
  }
  if (!hasSupabaseAdminConfig()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "supabase_admin_missing" };
  }

  const admin = createAdminClient();
  const targetDate = yesterdayInBusinessTimezone(now);
  const { data, error } = await admin
    .from("appointments")
    .select(FOLLOW_UP_SELECT)
    .eq("appointment_date", targetDate)
    .not("service_ended_at", "is", null)
    .is("followup_sent_at", null)
    .neq("status", "cancelled");

  if (error) {
    console.error("sendNextDayFollowUp lookup failed:", error.message);
    return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (data ?? []) as unknown as AppointmentRow[]) {
    const appointment = mapAppointmentRowToAdminRecord(row);
    const names = {
      firstName: appointment.customerFirstName,
      petName: appointment.petName,
    };
    const email = appointment.customerEmail.trim();
    const phone = normalizePhoneToE164(appointment.customerPhone ?? "");
    const canEmail = Boolean(email) && isEmailConfigured();
    const canSms = Boolean(phone) && isSmsConfigured();

    if (!canEmail && !canSms) {
      skipped += 1;
      continue;
    }

    let emailSent = false;
    let smsSent = false;

    if (canEmail) {
      const letter = buildNextDayFollowUpEmail(names);
      try {
        emailSent = await sendEmail({
          to: email,
          subject: letter.subject,
          text: letter.text,
          html: letter.html,
        });
      } catch (sendError) {
        console.error(
          "sendNextDayFollowUp email failed:",
          appointment.id,
          sendError,
        );
      }
    }

    if (canSms && phone) {
      const body = buildNextDayFollowUpSms(names);
      try {
        smsSent = Boolean(await sendSms({ to: phone, body }));
        if (smsSent) {
          await recordCustomerSms({
            direction: "outbound",
            phone,
            body,
            customerId: appointment.customerId,
            customerName: appointment.customerName,
            petNames: [appointment.petName],
          });
        }
      } catch (sendError) {
        console.error(
          "sendNextDayFollowUp SMS failed:",
          appointment.id,
          sendError,
        );
      }
    }

    if (!emailSent && !smsSent) {
      failed += 1;
      continue;
    }

    const { error: markError } = await admin
      .from("appointments")
      .update({ followup_sent_at: new Date().toISOString() })
      .eq("id", appointment.id);

    if (markError) {
      console.error(
        "sendNextDayFollowUp mark failed:",
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
