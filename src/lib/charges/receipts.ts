import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { buildCustomerSimpleLetterEmail } from "@/lib/email/layout";
import { isEmailConfigured, sendEmail, siteUrl } from "@/lib/email/resend";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { formatChargeMoney } from "@/lib/charges/money";
import {
  buildChargeReceiptParagraphs,
  chargeKindLabel,
  chargeReceiptGreeting,
} from "@/lib/charges/receipt-content";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";

export async function sendChargeReceiptEmail(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  if (!appointment.customerEmail || !isEmailConfigured()) return false;

  const greetingName = chargeReceiptGreeting(appointment);
  const bodyParagraphs = buildChargeReceiptParagraphs(appointment, charge);

  const text = [
    `Dear ${greetingName},`,
    "",
    ...bodyParagraphs,
    "",
    "K9 Atelier",
  ].join("\n");

  const letter = buildCustomerSimpleLetterEmail(
    {
      subject: `Your K9 Atelier receipt · ${formatChargeMoney(charge.total)}`,
      greetingName,
      bodyParagraphs,
      cta: {
        href: siteUrl("/account/bookings"),
        label: "VIEW APPOINTMENT",
      },
    },
    text,
  );

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

  const kindLabel = chargeKindLabel(charge.kind);
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const body = `K9 Atelier receipt: ${kindLabel} for ${appointment.petName} on ${dateLabel}. Total paid ${formatChargeMoney(charge.total)}. Thank you.`;
  return sendSms({ to, body });
}
