import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AppointmentRow } from "@/lib/appointments/types";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";
import { contactFromAdminAppointment } from "@/lib/email/appointment-context";
import { notifyMerchantCustomerReplyC } from "@/lib/communications/merchant-notices";
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
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import { buildCommunicationContext } from "@/lib/communications/context";

const INBOUND_SELECT = `
  id,
  customer_id,
  visit_id,
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
  staff_created,
  created_at,
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

export function customerReplyConfirmationVisit(matches: ReturnType<typeof mapAppointmentRowToAdminRecord>[], request?: { visit_id?: string | null; appointment_ids?: string[] | null } | null) {
  const requested = request ? matches.find((row) => request.visit_id ? row.visitId === request.visit_id : request.appointment_ids?.includes(row.id)) : undefined;
  const appointment = requested ?? matches.find((row) => row.staffCreated && row.status === "pending_confirmation" && !row.customerConfirmedAt)
    ?? matches.find((row) => row.reminderSmsSentAt && !row.customerConfirmedAt)
    ?? matches.find((row) => !row.customerConfirmedAt) ?? matches[0];
  if (!appointment) return null;
  const pets = matches.filter((row) => row.customerId === appointment.customerId &&
    (appointment.visitId ? row.visitId === appointment.visitId : row.id === appointment.id));
  return { appointment, pets, petName: formatVisitPetNames(pets.map((row) => row.petName), appointment.petName) };
}

export async function persistCustomerReplyConfirmation(
  visit: NonNullable<ReturnType<typeof customerReplyConfirmationVisit>>,
  write: (ids: string[], customerId: string, patch: { status: "confirmed"; confirmed_at: string; customer_confirmed_at: string }) => PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }>,
): Promise<"confirmed" | "already" | "failed"> {
  if (visit.pets.every((pet) => pet.customerConfirmedAt)) return "already";
  const now = new Date().toISOString();
  try {
    const result = await write(visit.pets.map((pet) => pet.id), visit.appointment.customerId,
      { status: "confirmed", confirmed_at: visit.appointment.confirmedAt ?? now, customer_confirmed_at: now });
    if (result.error) {
      console.error("customer SMS confirmation failed:", result.error.message);
      return "failed";
    }
    return result.data?.length ? "confirmed" : "already";
  } catch (error) {
    console.error("customer SMS confirmation failed:", error);
    return "failed";
  }
}

function firstName(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first || "there";
}

export function buildCustomerYesReceivedSms(input: {
  customerName?: string | null;
  petName: string;
  dateLabel: string;
}) {
  return `K9 ATELIER: Thanks ${firstName(input.customerName)} — we received your confirmation for ${input.petName} on ${input.dateLabel}.\n\nReply STOP to opt out.`;
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

  // Bind C to the latest actual confirmation request, including retries after confirmation.
  const { data: latestRequest, error: requestError } = await admin.from("communication_logs")
    .select("visit_id, appointment_ids").eq("channel", "sms").eq("audience", "customer")
    .eq("recipient", input.from)
    .in("notification_type", ["staff_created_booking", "confirm_reminder_3_day"])
    .in("status", ["accepted", "delivered"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (requestError) {
    console.error("customer SMS confirmation request lookup failed:", requestError.message);
    return { handled: "unmatched" };
  }
  const visit = customerReplyConfirmationVisit(matches, latestRequest);
  if (!visit) {
    return { handled: "unmatched" };
  }
  const { appointment, pets, petName } = visit;

  const contact = contactFromAdminAppointment(appointment);
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const outcome = await persistCustomerReplyConfirmation(visit, (ids, customerId, patch) => admin
      .from("appointments")
      .update(patch)
      .in("id", ids)
      .eq("customer_id", customerId)
      .in("status", ["pending_confirmation", "confirmed"])
      .is("customer_confirmed_at", null)
      .select("id"));
  if (outcome === "failed") return { handled: "unmatched" };
  const already = outcome === "already";
  if (already) return { handled: "yes", already: true, appointmentId: appointment.id };

  const reply = buildCustomerYesReceivedSms({
    customerName: contact?.firstName ?? contact?.name,
    petName,
    dateLabel,
  });
  await sendSms({ to: input.from, body: reply, communication: buildCommunicationContext({
    notificationType: "customer_sms_confirmation", recipient: input.from,
    customerId: appointment.customerId, visitId: appointment.visitId,
    appointmentIds: pets.map((pet) => pet.id), petIds: pets.map((pet) => pet.petId),
    dedupe: appointment.visitId ? "visit" : "appointment",
  }) });

  if (!already) {
    try {
      await notifyMerchantCustomerReplyC({
        visitId: appointment.visitId ?? null,
        customerId: appointment.customerId,
        customerName: contact?.name ?? contact?.email ?? null,
        replyTo: contact?.email ?? null,
        appointmentId: appointment.id,
        petId: appointment.petId,
        petName,
        serviceName: appointment.serviceName,
        whenLabel: `${dateLabel} · ${appointment.appointmentTime}`,
        addressLabel: [
          appointment.addressStreet,
          appointment.addressCity,
          appointment.addressState,
          appointment.addressZip,
        ]
          .filter(Boolean)
          .join(", "),
      });
    } catch (error) {
      console.error("customer reply C merchant notify failed:", error);
    }
  }

  return { handled: "yes", already, appointmentId: appointment.id };
}
