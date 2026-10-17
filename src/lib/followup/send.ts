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
  NEXT_DAY_FOLLOWUP_CATCHUP_DAYS,
  planNextDayFollowUp,
  type FollowUpPet,
} from "@/lib/followup/visit-ready";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  addDaysToIsoDate,
  hourInBusinessTimezone,
  yesterdayInBusinessTimezone,
} from "@/lib/sms/schedule";
import { isSmsConfigured, sendSmsDelivery } from "@/lib/sms/twilio";
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import {
  recordVisitNotificationSent,
  runVisitNotification,
} from "@/lib/visits/notification-ledger";
import { groupByVisit } from "@/lib/visits/notification-scope";
import {
  combineProviderDeliveries,
  type ProviderDelivery,
} from "@/lib/visits/provider-delivery";

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
  const targetDate = yesterdayInBusinessTimezone(now);
  const catchupStart = addDaysToIsoDate(
    targetDate,
    -(NEXT_DAY_FOLLOWUP_CATCHUP_DAYS - 1),
  );
  const { data, error } = await admin
    .from("appointments")
    .select(FOLLOW_UP_SELECT)
    .gte("appointment_date", catchupStart)
    .lte("appointment_date", targetDate)
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
    const plan = planNextDayFollowUp(pets);
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

    const outcome = await runVisitNotification({
      visitId: anchor.visitId,
      event: "next_day_followup",
      send: async () => {
        const outcomes: ProviderDelivery[] = [];
        if (canEmail) {
          const letter = buildNextDayFollowUpEmail(names);
          outcomes.push(
            await sendEmailDelivery({
              to: email,
              subject: letter.subject,
              text: letter.text,
              html: letter.html,
              communication: contextFor(email),
            }),
          );
        }
        if (canSms && phone) {
          const body = buildNextDayFollowUpSms(names);
          const smsOutcome = await sendSmsDelivery({
            to: phone,
            body,
            communication: contextFor(phone),
          });
          outcomes.push(smsOutcome);
          if (smsOutcome === "delivered") {
            await recordCustomerSms({
              direction: "outbound",
              phone,
              body,
              customerId: anchor.customerId,
              customerName: anchor.customerName,
              petNames,
            });
          }
        }
        return combineProviderDeliveries(outcomes);
      },
    });

    if (outcome === "skipped") {
      skipped += 1;
      continue;
    }
    if (outcome !== "sent") {
      failed += 1;
      continue;
    }

    await recordVisitNotificationSent(anchor.visitId, "google_review_request");
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
    sent += 1;
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
