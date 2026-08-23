import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { getBookAgainUrl, getGoogleWriteReviewUrl } from "@/lib/business";
import { isEmailConfigured, sendEmail, siteUrl } from "@/lib/email/resend";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
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
  if (!appointment.customerEmail || !isEmailConfigured()) return false;
  const letter = buildChargeReceiptEmail(appointment, charge);
  return sendEmail({
    to: appointment.customerEmail,
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
  });
}

export async function sendChargeReceiptSms(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  if (!appointment.customerPhone || !isSmsConfigured()) return false;
  const to = normalizePhoneToE164(appointment.customerPhone);
  if (!to) return false;
  return sendSms({ to, body: buildChargeReceiptSmsText(appointment, charge) });
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
    "Share a concern privately:",
    siteUrl("/contact?topic=concern"),
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}

export async function sendAfterVisitThankYouSms(
  appointment: AdminAppointmentRecord,
) {
  if (!appointment.customerPhone || !isSmsConfigured()) return false;
  const to = normalizePhoneToE164(appointment.customerPhone);
  if (!to) return false;
  return sendSms({ to, body: buildAfterVisitThankYouSms(appointment) });
}
