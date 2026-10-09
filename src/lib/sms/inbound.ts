import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";
import { contactFromAdminAppointment } from "@/lib/email/appointment-context";
import { business } from "@/lib/business";
import { sendEmail } from "@/lib/email/resend";
import { phonesMatch } from "@/lib/sms/phone";
import { sendSms } from "@/lib/sms/twilio";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import { inboundReplyTextForStaff } from "@/lib/sms/inbox-copy";
import {
  forwardInboundSmsToStaff,
  isStaffPhone,
  recordCustomerSms,
} from "@/lib/sms/inbox";
import { handleStaffPhoneReply } from "@/lib/sms/staff-reply";
import { loadVisitNoticePets } from "@/lib/visits/notification-context";
import { runVisitNotification } from "@/lib/visits/notification-ledger";
import { activeVisitPets } from "@/lib/visits/notification-scope";
import { formatVisitPetNames } from "@/lib/visits/pet-names";

const INBOUND_SELECT = `
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
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

/** C confirms. YES and Y still count for texts already sent. */
export function isCustomerYesReply(body: string) {
  const text = body.trim().replace(/[.!]+$/g, "").trim();
  return /^(C|YES|Y)$/i.test(text);
}

export function isIgnoredInboundReply(body: string) {
  const text = body.trim().replace(/[.!]+$/g, "").trim();
  return /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|HELP|INFO|START|UNSTOP)$/i.test(
    text,
  );
}

export { phonesMatch };

function firstName(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first || "there";
}

export function buildCustomerYesReceivedSms(input: {
  customerName?: string | null;
  petName: string;
  petNames?: string[];
  dateLabel: string;
}) {
  const pet =
    input.petNames && input.petNames.length > 1
      ? formatVisitPetNames(input.petNames, input.petName)
      : input.petName;
  return `K9 ATELIER: Thanks ${firstName(input.customerName)} — we received your confirmation for ${pet} on ${input.dateLabel}.\n\nReply STOP to opt out.`;
}

export type InboundSmsResult =
  | { handled: "ignored" }
  | { handled: "message" }
  | { handled: "staff_reply" }
  | { handled: "yes"; already: boolean; appointmentId: string }
  | { handled: "unmatched" };

export async function handleInboundCustomerSms(input: {
  from: string;
  to?: string;
  body: string;
  mediaUrls?: string[];
}): Promise<InboundSmsResult> {
  const mediaUrls = (input.mediaUrls ?? []).filter(Boolean).slice(0, 10);
  if (isIgnoredInboundReply(input.body)) {
    return { handled: "ignored" };
  }
  if (isStaffPhone(input.from)) {
    await handleStaffPhoneReply({
      from: input.from,
      to: input.to,
      body: input.body,
      mediaUrls,
    });
    return { handled: "staff_reply" };
  }
  if (!input.body.trim() && mediaUrls.length === 0) {
    return { handled: "ignored" };
  }

  const customer = await lookupCustomerByPhone(input.from);
  await recordCustomerSms({
    direction: "inbound",
    phone: input.from,
    body: inboundReplyTextForStaff({
      body: input.body,
      mediaCount: mediaUrls.length,
    }),
    customer,
    mediaUrls,
  });
  await forwardInboundSmsToStaff({
    from: input.from,
    body: input.body,
    customer,
    mediaUrls,
  });

  if (!isCustomerYesReply(input.body)) {
    return { handled: "message" };
  }
  if (!hasSupabaseAdminConfig()) {
    return { handled: "unmatched" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(INBOUND_SELECT)
    .in("status", ["confirmed", "pending_confirmation"])
    .gte("appointment_date", todayInBusinessTimezone())
    .order("appointment_date", { ascending: true });

  if (error) {
    console.error("handleInboundCustomerSms lookup failed:", error.message);
    return { handled: "unmatched" };
  }

  const matches = ((data ?? []) as unknown as AppointmentRow[])
    .map(mapAppointmentRowToAdminRecord)
    .filter((appointment) => phonesMatch(appointment.customerPhone, input.from));

  const appointment =
    matches.find((row) => row.reminderSmsSentAt && !row.customerConfirmedAt) ??
    matches.find((row) => !row.customerConfirmedAt) ??
    matches[0];

  if (!appointment) {
    return { handled: "unmatched" };
  }

  const contact = contactFromAdminAppointment(appointment);
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const already = Boolean(appointment.customerConfirmedAt);
  const siblings = appointment.visitId
    ? await loadVisitNoticePets(appointment.visitId)
    : null;
  const pets = siblings ? (activeVisitPets(siblings) ?? siblings) : null;
  const petNames = pets?.map((pet) => pet.petName) ?? [appointment.petName];
  const petLabel = formatVisitPetNames(petNames, appointment.petName);

  const markedAt = new Date().toISOString();
  const mark = admin
    .from("appointments")
    .update({ customer_confirmed_at: markedAt })
    .in("status", ["confirmed", "pending_confirmation"])
    .is("customer_confirmed_at", null);
  const { error: markError } = appointment.visitId
    ? await mark.eq("visit_id", appointment.visitId)
    : await mark.eq("id", appointment.id);

  if (markError) {
    console.error(
      "handleInboundCustomerSms mark failed:",
      appointment.id,
      markError.message,
    );
  }

  await runVisitNotification({
    visitId: appointment.visitId,
    event: "customer_reply_c",
    send: async () => {
      const reply = buildCustomerYesReceivedSms({
        customerName: contact?.firstName ?? contact?.name,
        petName: appointment.petName,
        petNames,
        dateLabel,
      });
      const texted = await sendSms({ to: input.from, body: reply });
      const mailed = await sendEmail({
        to: business.brand.email,
        subject: `[K9 Atelier] Customer confirmed — ${petLabel}`,
        text: [
          `${contact?.name ?? contact?.email ?? "A customer"} replied ${input.body.trim()} to confirm.`,
          "",
          `Pets: ${petLabel}`,
          `Service: ${appointment.serviceName}`,
          `Date: ${dateLabel} · ${appointment.appointmentTime}`,
          "",
          "This is the customer SMS confirmation. It does not change staff/vaccination booking status.",
        ].join("\n"),
      });
      return Boolean(texted) || mailed;
    },
  });

  return { handled: "yes", already, appointmentId: appointment.id };
}
