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
  reminder_sms_sent_at,
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

export function isCustomerYesReply(body: string) {
  const text = body.trim().replace(/[.!]+$/g, "").trim();
  return /^(YES|Y)$/i.test(text);
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
  dateLabel: string;
}) {
  return `K9 ATELIER: Thanks ${firstName(input.customerName)} — we received your YES for ${input.petName} on ${input.dateLabel}.\n\nReply STOP to opt out.`;
}

export type InboundSmsResult =
  | { handled: "ignored" }
  | { handled: "message" }
  | { handled: "yes"; already: boolean; appointmentId: string }
  | { handled: "unmatched" };

export async function handleInboundCustomerSms(input: {
  from: string;
  body: string;
  mediaUrls?: string[];
}): Promise<InboundSmsResult> {
  const mediaUrls = (input.mediaUrls ?? []).filter(Boolean).slice(0, 10);
  if (isIgnoredInboundReply(input.body) || isStaffPhone(input.from)) {
    return { handled: "ignored" };
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

  if (!already) {
    const { error: markError } = await admin
      .from("appointments")
      .update({ customer_confirmed_at: new Date().toISOString() })
      .eq("id", appointment.id)
      .is("customer_confirmed_at", null);

    if (markError) {
      console.error(
        "handleInboundCustomerSms mark failed:",
        appointment.id,
        markError.message,
      );
    }
  }

  const reply = buildCustomerYesReceivedSms({
    customerName: contact?.firstName ?? contact?.name,
    petName: appointment.petName,
    dateLabel,
  });
  await sendSms({ to: input.from, body: reply });

  if (!already) {
    await sendEmail({
      to: business.brand.email,
      subject: `[K9 Atelier] Customer YES — ${appointment.petName}`,
      text: [
        `${contact?.name ?? contact?.email ?? "A customer"} replied YES.`,
        "",
        `Pet: ${appointment.petName}`,
        `Service: ${appointment.serviceName}`,
        `Date: ${dateLabel} · ${appointment.appointmentTime}`,
        "",
        "This is the customer SMS confirmation. It does not change staff/vaccination booking status.",
      ].join("\n"),
    });
  }

  return { handled: "yes", already, appointmentId: appointment.id };
}
