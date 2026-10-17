import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { buildCommunicationContext } from "@/lib/communications/context";
import { isEmailConfigured, sendEmailDelivery } from "@/lib/email/resend";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
} from "@/lib/followup/copy";
import {
  followUpDecision,
  type FollowUpPet,
} from "@/lib/followup/visit-ready";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  businessDayUtcRange,
  hourInBusinessTimezone,
  yesterdayInBusinessTimezone,
} from "@/lib/sms/schedule";
import { isSmsConfigured, sendSmsDelivery } from "@/lib/sms/twilio";
import { deliverVisitChannels } from "@/lib/visits/channel-delivery";
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import { recordVisitNotificationSent } from "@/lib/visits/notification-ledger";
import { groupByVisit } from "@/lib/visits/notification-scope";

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
  visit_id,
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
  const completionDay = businessDayUtcRange(yesterdayInBusinessTimezone(now));
  const { data, error } = await admin
    .from("appointments")
    .select(FOLLOW_UP_SELECT)
    .gte("service_ended_at", completionDay.start)
    .lt("service_ended_at", completionDay.end)
    .is("followup_sent_at", null)
    .neq("status", "cancelled");

  if (error) {
    console.error("sendNextDayFollowUp lookup failed:", error.message);
    return { sent: 0, skipped: 0, failed: 0, reason: "lookup_failed" };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const appointments = ((data ?? []) as unknown as AppointmentRow[]).map(
    mapAppointmentRowToAdminRecord,
  );

  for (const group of groupByVisit(appointments)) {
    const anchor = group[0]!;
    const pets = anchor.visitId
      ? await loadVisitFollowUpPets(anchor.visitId)
      : group.map(petFromAppointment);
    if (!pets) {
      failed += 1;
      continue;
    }
    const plan = followUpDecision(pets, now);
    if (plan !== "send") {
      skipped += 1;
      continue;
    }

    const petNames = pets
      .filter((pet) => pet.status !== "cancelled")
      .map((pet) => pet.name);
    const names = {
      firstName: anchor.customerFirstName,
      petName: formatVisitPetNames(petNames, anchor.petName),
    };
    const email = anchor.customerEmail.trim();
    const phone = normalizePhoneToE164(anchor.customerPhone ?? "");
    const canEmail = Boolean(email) && isEmailConfigured();
    const canSms = Boolean(phone) && isSmsConfigured();
    if (!canEmail && !canSms) {
      skipped += 1;
      continue;
    }

    const appointmentIds = pets
      .filter((pet) => pet.status !== "cancelled")
      .map((pet) => pet.id);
    const contextFor = (recipient: string) =>
      buildCommunicationContext({
        notificationType: "next_day_followup",
        recipient,
        customerId: anchor.customerId,
        visitId: anchor.visitId,
        appointmentIds,
        petIds: group.map((row) => row.petId),
        dedupe: anchor.visitId ? "visit" : "appointment",
      });

    const letter = buildNextDayFollowUpEmail(names);
    const smsBody = buildNextDayFollowUpSms(names);
    const channels = await deliverVisitChannels({
      visitId: anchor.visitId,
      event: "next_day_followup",
      email: canEmail
        ? () =>
            sendEmailDelivery({
              to: email,
              subject: letter.subject,
              text: letter.text,
              html: letter.html,
              communication: contextFor(email),
            })
        : undefined,
      sms:
        canSms && phone
          ? async () => {
              const smsOutcome = await sendSmsDelivery({
                to: phone,
                body: smsBody,
                communication: contextFor(phone),
              });
              if (smsOutcome === "delivered") {
                await recordCustomerSms({
                  direction: "outbound",
                  phone,
                  body: smsBody,
                  customerId: anchor.customerId,
                  customerName: anchor.customerName,
                  petNames,
                });
              }
              return smsOutcome;
            }
          : undefined,
    });

    const attempted = [channels.email, channels.sms].filter(
      (result) => result !== "absent",
    );
    const newlySent = attempted.some((result) => result === "sent");
    if (newlySent) {
      await recordVisitNotificationSent(anchor.visitId, "google_review_request");
    }
    const settled = attempted.every(
      (result) => result === "sent" || result === "skipped",
    );
    if (!settled) {
      failed += 1;
      continue;
    }
    if (newlySent) sent += 1;
    else skipped += 1;

    const { error: markError } = await admin
      .from("appointments")
      .update({ followup_sent_at: new Date().toISOString() })
      .in("id", appointmentIds)
      .is("followup_sent_at", null);
    if (markError) {
      console.error(
        "sendNextDayFollowUp mark failed:",
        anchor.id,
        markError.message,
      );
    }
  }

  return { sent, skipped, failed };
}

function petFromAppointment(row: {
  id: string;
  status: string;
  serviceEndedAt: string | null;
  petName: string;
}): FollowUpPet & { name: string } {
  return {
    id: row.id,
    status: row.status,
    serviceEndedAt: row.serviceEndedAt,
    followupSentAt: null,
    name: row.petName,
  };
}

async function loadVisitFollowUpPets(
  visitId: string,
): Promise<Array<FollowUpPet & { name: string }> | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select("id, status, service_ended_at, followup_sent_at, pets ( name )")
    .eq("visit_id", visitId);
  if (error) {
    console.error("sendNextDayFollowUp visit load failed:", error.message);
    return null;
  }
  return (data ?? []).map((row) => {
    const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    return {
      id: row.id as string,
      status: row.status as string,
      serviceEndedAt: (row.service_ended_at as string | null) ?? null,
      followupSentAt: (row.followup_sent_at as string | null) ?? null,
      name: pet?.name?.trim() || "your dog",
    };
  });
}
