import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { getBookAgainUrl } from "@/lib/business";
import { buildCommunicationContext } from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { formatChargeMoney } from "@/lib/charges/money";
import { receiptPetNames } from "@/lib/charges/receipt-view";
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
    subject: `Receipt for ${receiptPetNames(appointment, charge) || "your pet"}`,
    text: buildChargeReceiptCardText(appointment, charge, paymentMethodLabel),
    html: buildChargeReceiptCardHtml(appointment, charge, paymentMethodLabel),
  };
}

export function buildChargeReceiptSmsText(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  const kindLabel = chargeKindLabel(charge.kind);
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const who = charge.billSnapshot
    ? charge.billSnapshot.pets.map((pet) => pet.petName).join(", ")
    : appointment.petName;
  return `K9 Atelier receipt: ${kindLabel} for ${who} on ${dateLabel}. Total paid ${formatChargeMoney(charge.total)}. Book again: ${getBookAgainUrl()}`;
}

export async function sendChargeReceiptEmail(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
  paymentMethodLabel?: string | null,
) {
  if (!appointment.customerEmail || !isEmailConfigured()) return false;
  const letter = buildChargeReceiptEmail(
    appointment,
    charge,
    paymentMethodLabel ?? charge.billSnapshot?.paymentMethodLabel,
  );
  return isCommunicationAccepted(
    await sendEmail({
      to: appointment.customerEmail,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
      communication: buildCommunicationContext({
        notificationType: "payment_receipt",
        recipient: appointment.customerEmail,
        customerId: appointment.customerId,
        visitId: appointment.visitId,
        appointmentIds: [appointment.id],
        petIds: [appointment.petId],
        dedupe: appointment.visitId ? "visit" : "appointment",
        fingerprint: charge.id,
      }),
    }),
  );
}

export async function sendChargeReceiptSms(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  if (!appointment.customerPhone || !isSmsConfigured()) return false;
  const to = normalizePhoneToE164(appointment.customerPhone);
  if (!to) return false;
  return isCommunicationAccepted(
    await sendSms({
      to,
      body: buildChargeReceiptSmsText(appointment, charge),
      communication: buildCommunicationContext({
        notificationType: "payment_receipt",
        recipient: to,
        customerId: appointment.customerId,
        visitId: appointment.visitId,
        appointmentIds: [appointment.id],
        petIds: [appointment.petId],
        dedupe: appointment.visitId ? "visit" : "appointment",
        fingerprint: charge.id,
      }),
    }),
  );
}

export function buildAfterVisitThankYouSms(
  appointment: AdminAppointmentRecord,
  charge?: AppointmentChargeRecord,
) {
  const petName = (charge ? receiptPetNames(appointment, charge) : appointment.petName?.trim()) || "your pet";
  return [
    `K9 ATELIER: We keep a record of all tools and products used at every appointment for ${petName}.`,
    "If you have any questions about the service or would prefer a different fragrance, please feel free to contact us anytime. We have a full range of show dog grooming products and can tailor the products and fragrance to your preferences.",
    "Thank you for trusting K9 Atelier. We look forward to seeing you again!",
    "Reply STOP to opt out.",
  ].join("\n");
}

export async function sendAfterVisitThankYouSms(
  appointment: AdminAppointmentRecord,
  charge?: AppointmentChargeRecord,
) {
  if (!appointment.customerPhone || !isSmsConfigured()) return false;
  const to = normalizePhoneToE164(appointment.customerPhone);
  if (!to) return false;
  return isCommunicationAccepted(
    await sendSms({
      to,
      body: buildAfterVisitThankYouSms(appointment, charge),
      communication: buildCommunicationContext({
        notificationType: "payment_thank_you",
        recipient: to,
        customerId: appointment.customerId,
        visitId: appointment.visitId,
        appointmentIds: [appointment.id],
        petIds: [appointment.petId],
        dedupe: appointment.visitId ? "visit" : "appointment",
      }),
    }),
  );
}
