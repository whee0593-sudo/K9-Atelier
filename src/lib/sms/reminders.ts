import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { buildCommunicationContext } from "@/lib/communications/context";
import { communicationToDelivery } from "@/lib/communications/delivery";
import { isEmailConfigured, sendEmailDelivery, siteUrl } from "@/lib/email/resend";
import { listPaymentMethodsForCustomer } from "@/lib/payments/service";
import { sendAppointmentConfirmRequestSms } from "@/lib/sms/appointment-sms";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { appointmentNeedsAddress } from "@/lib/staff/booking-address";
import { buildStaffCreatedBookingEmail, buildStaffCreatedBookingSms } from "@/lib/staff/customer-booking-copy";
import { createCustomerReminderToken, customerConfirmPath } from "@/lib/staff/customer-confirm-token";
import { usableConfirmationCards } from "@/lib/staff/customer-confirm-status";
import { isInternalCustomerEmail } from "@/lib/staff/owner";
import { groupByVisit } from "@/lib/visits/notification-scope";
import {
  addDaysToIsoDate,
  businessDayUtcRange,
  hourInBusinessTimezone,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import type { ProviderDelivery } from "@/lib/visits/provider-delivery";

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
  scheduled_start,
  estimated_duration_minutes,
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  staff_created,
  customer_confirm_token_hash,
  created_at,
  visit_id,
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
  if (!hasSupabaseAdminConfig()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "supabase_admin_missing" };
  }

  const admin = createAdminClient();
  const today = todayInBusinessTimezone();
  const targetDate = addDaysToIsoDate(today, CONFIRM_REQUEST_LEAD_DAYS);
  const { data, error } = await admin
    .from("appointments")
    .select(REMINDER_SELECT)
    .or(`and(status.eq.confirmed,appointment_date.eq.${targetDate}),and(status.eq.pending_confirmation,staff_created.eq.true)`)
    .gte("appointment_date", today)
    .lte("appointment_date", targetDate)
    .order("scheduled_start", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("sendThreeDayConfirmRequestSms lookup failed:", error.message);
    return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const rows = (data ?? []) as unknown as AppointmentRow[];
  for (const visit of groupByVisit(rows.map((row) => ({ ...row, visitId: row.visit_id })))) {
    const group = visit.map(mapAppointmentRowToAdminRecord);
    const appointment = group[0]!;
    const staffReservation = visit.find((row) => row.staff_created &&
      (row.status === "pending_confirmation" || row.customer_confirm_token_hash));
    const phone = normalizePhoneToE164(appointment.customerPhone ?? "");
    const email = appointment.customerEmail.trim();
    const requiresEmail = !email || isInternalCustomerEmail(email);
    const shouldSend = appointment.appointmentDate === targetDate &&
      !visit.some((row) => row.reminder_sms_sent_at);
    const petNames = [...new Set(group.map((row) => row.petName))];
    const scope = {
      appointmentIds: group.map((row) => row.id),
      petIds: group.map((row) => row.petId),
    };
    const outcomes: ProviderDelivery[] = [];
    let needsDetails = false;

    if (staffReservation) {
      const methods = await listPaymentMethodsForCustomer(appointment.customerId);
      if (!methods) {
        failed += 1;
        continue;
      }
      const requiresCard = usableConfirmationCards(methods).length === 0;
      const requiresAddress = group.some(appointmentNeedsAddress);
      const requiresPhone = !phone;
      needsDetails = requiresCard || requiresAddress || requiresEmail || requiresPhone;
      const pendingIds = visit.filter((row) => row.staff_created && row.status === "pending_confirmation")
        .map((row) => row.id);
      if (!needsDetails && pendingIds.length) {
        const { error: confirmError } = await admin.from("appointments")
          .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
          .in("id", pendingIds)
          .eq("status", "pending_confirmation")
          .eq("appointment_date", appointment.appointmentDate);
        if (confirmError) {
          console.error("Could not confirm complete staff booking:", confirmError.message);
          failed += 1;
          continue;
        }
      }
      if (!shouldSend) continue;
      if (needsDetails) {
        const originalHash = staffReservation.customer_confirm_token_hash;
        const token = originalHash && createCustomerReminderToken(staffReservation.id, targetDate, originalHash);
        if (!originalHash || !token) {
          failed += 1;
          continue;
        }
        // The address completion RPC also checks the original token's expiry.
        const expiresAt = businessDayUtcRange(targetDate).end;
        const { error: expiryError } = await admin.from("appointments")
          .update({ customer_confirm_expires_at: expiresAt })
          .in("id", scope.appointmentIds)
          .eq("customer_confirm_token_hash", originalHash)
          .or(`customer_confirm_expires_at.is.null,customer_confirm_expires_at.lt.${expiresAt}`);
        if (expiryError) {
          console.error("Could not extend booking confirmation expiry:", expiryError.message);
          failed += 1;
          continue;
        }
        const confirmUrl = siteUrl(customerConfirmPath(token));
        const notice = {
          firstName: appointment.customerFirstName ?? "",
          confirmUrl,
          createdAccount: false,
          requiresCard,
          requiresAddress,
          requiresEmail,
          requiresPhone,
        };
        const communication = (recipient: string) => buildCommunicationContext({
          ...scope,
          notificationType: "confirm_reminder_3_day",
          recipient,
          customerId: appointment.customerId,
          visitId: appointment.visitId,
          dedupe: "visit",
        });
        if (phone && isSmsConfigured()) {
          outcomes.push(communicationToDelivery(await sendSms({
            to: phone,
            body: buildStaffCreatedBookingSms(appointment, confirmUrl, petNames, notice),
            communication: communication(phone),
          })));
        }
        if (!requiresEmail && isEmailConfigured()) {
          outcomes.push(await sendEmailDelivery({
            ...buildStaffCreatedBookingEmail(appointment, notice, group),
            to: email,
            communication: communication(email),
          }));
        }
      }
    }
    if (!shouldSend) continue;
    if (!needsDetails && phone && isSmsConfigured()) {
      outcomes.push(await sendAppointmentConfirmRequestSms(
        appointment, { email, phone, name: appointment.customerName, firstName: appointment.customerFirstName }, petNames, scope,
        group.some((row) => row.staffCreated && !row.customerConfirmedAt),
      ));
    }
    if (!outcomes.length || outcomes.some((outcome) => outcome !== "delivered")) {
      if (outcomes.includes("rejected")) failed += 1;
      else skipped += 1;
      continue;
    }

    const { error: markError } = await admin
      .from("appointments")
      .update({ reminder_sms_sent_at: new Date().toISOString() })
      .in(
        "id",
        scope.appointmentIds,
      );

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
