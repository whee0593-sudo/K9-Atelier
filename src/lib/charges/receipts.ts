import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { getBookAgainUrl, getGoogleWriteReviewUrl } from "@/lib/business";
import { buildCommunicationContext } from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
import { sendEmail, siteUrl } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { formatChargeMoney } from "@/lib/charges/money";
import { chargeKindLabel } from "@/lib/charges/receipt-content";
import {
  buildChargeReceiptCardHtml,
  buildChargeReceiptCardText,
} from "@/lib/charges/receipt-email";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";

export function buildChargeReceiptEmail(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
  paymentMethodLabel?: string | null,
) {
  return {
    subject: `Your K9 Atelier receipt · ${formatChargeMoney(charge.total)}`,
    text: buildChargeReceiptCardText(appointment, charge),
    html: buildChargeReceiptCardHtml(appointment, charge, paymentMethodLabel),
  };
}

export function buildChargeReceiptSmsText(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  const kindLabel = chargeKindLabel(charge.kind);
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  return `K9 Atelier receipt: ${kindLabel} for ${appointment.petName} on ${dateLabel}. Total paid ${formatChargeMoney(charge.total)}. Book again: ${getBookAgainUrl()}`;
}

export async function sendChargeReceiptEmail(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  const letter = buildChargeReceiptEmail(appointment, charge);
  return sendEmail({
    to: appointment.customerEmail,
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
    communication: buildCommunicationContext({
      notificationType: "receipt",
      recipient: appointment.customerEmail,
      customerId: appointment.customerId,
      visitId: appointment.visitId ?? null,
      appointmentIds: [appointment.id],
      petIds: [appointment.petId],
      fingerprint: charge.id,
    }),
  });
}

export async function sendChargeReceiptSms(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  const to = normalizePhoneToE164(appointment.customerPhone ?? "") ?? "";
  const result = await sendSms({
    to,
    body: buildChargeReceiptSmsText(appointment, charge),
    communication: buildCommunicationContext({
      notificationType: "receipt",
      recipient: to || appointment.customerPhone || "missing",
      customerId: appointment.customerId,
      visitId: appointment.visitId ?? null,
      appointmentIds: [appointment.id],
      petIds: [appointment.petId],
      fingerprint: charge.id,
    }),
  });
  return isCommunicationAccepted(result);
}

export function buildAfterVisitThankYouSms(appointment: AdminAppointmentRecord) {
  const petName = appointment.petName?.trim() || "your pet";
  const google = getGoogleWriteReviewUrl() ?? "";
  return [
    `K9 ATELIER: Thank you for entrusting ${petName}’s care to us. We truly appreciate your business.`,
    "",
    "Share your experience on Google:",
    google,
    "",
    "Reserve your next appointment:",
    getBookAgainUrl(),
    "",
    "Share a concern with us:",
    siteUrl("/contact?topic=concern"),
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}

export async function sendAfterVisitThankYouSms(
  appointment: AdminAppointmentRecord,
  chargeId?: string,
) {
  const to = normalizePhoneToE164(appointment.customerPhone ?? "") ?? "";
  const result = await sendSms({
    to,
    body: buildAfterVisitThankYouSms(appointment),
    communication: buildCommunicationContext({
      notificationType: "thank_you",
      recipient: to || appointment.customerPhone || "missing",
      customerId: appointment.customerId,
      visitId: appointment.visitId ?? null,
      appointmentIds: [appointment.id],
      petIds: [appointment.petId],
      fingerprint: chargeId ?? appointment.id,
    }),
  });
  return isCommunicationAccepted(result);
}
