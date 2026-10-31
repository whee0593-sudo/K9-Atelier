import { EMAIL_FONT_FAMILY } from "@/lib/email/typography";
import {
  getBookAgainUrl,
  getBrandInstagramUrl,
  getBrandWebsiteUrl,
  getGoogleWriteReviewUrl,
  getGoogleProfileUrl,
} from "@/lib/business";
import { business } from "@/lib/business";
import { formatChargeMoney } from "@/lib/charges/money";
import {
  formatReceiptDate,
  formatReceiptPaymentDate,
  formatReceiptServiceTime,
  receiptPaymentStatus,
  receiptPetNames,
} from "@/lib/charges/receipt-view";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { escapeHtml, emailLogoImg } from "@/lib/email/layout";
import { groupChargeItems, receiptItems } from "@/lib/charges/receipt-items";
import { siteUrl } from "@/lib/email/site-url";

const PAGE = "#F8F4ED";
const CARD = "#FFFDFC";
const LAVENDER = "#756578";
const INK = "#2F2930";
const MUTED = "#766F75";
const LINE = "#E7DED2";

function thankYouLine(petName: string | null) {
  return petName
    ? `We are truly grateful that you have entrusted ${petName}’s care to K9 Atelier.`
    : "We are truly grateful for choosing K9 Atelier.";
}

function moneyCell(amountHtml: string, size: string) {
  return `<td style="padding:4px 0;color:${INK};font-size:${size};line-height:1.6;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-family:${EMAIL_FONT_FAMILY};">${amountHtml}</td>`;
}

function moneyRow(label: string, amount: number, emphasize = false, columns = 3) {
  const size = emphasize ? "18px" : "16px";
  return `<tr>
    <td colspan="${columns - 1}" style="padding:4px 12px 4px 0;color:${INK};font-size:${size};line-height:1.6;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(label)}</td>
    ${moneyCell(escapeHtml(formatChargeMoney(amount)), size)}
  </tr>`;
}

function sectionLabel(label: string) {
  return `<p style="margin:0 0 10px;color:${LAVENDER};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(label)}</p>`;
}

function emailButton(href: string, label: string) {
  return `<tr>
    <td align="center" style="padding:4px 0;font-family:${EMAIL_FONT_FAMILY};font-size:16px;">
      <a href="${escapeHtml(href)}" style="display:block;max-width:264px;margin:0 auto;background:#6b596e;border-radius:8px;color:#FFFDFC;text-decoration:none;text-align:center;padding:12px 8px;font-size:13px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(label)}</a>
    </td>
  </tr>`;
}

export function buildChargeReceiptCardHtml(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
  paymentMethodLabel?: string | null,
) {
  const snapshot = charge.billSnapshot;
  const petName = receiptPetNames(appointment, charge);
  const appointmentDate = formatReceiptDate(
    snapshot?.serviceDate ?? appointment.appointmentDate,
  );
  const appointmentTime = snapshot?.arrivalLabel
    ? snapshot.arrivalLabel
    : formatReceiptServiceTime(appointment);
  const paymentDate = formatReceiptPaymentDate(
    charge.paidAt,
    appointment.timezone,
  );
  const paymentStatus = receiptPaymentStatus(charge);
  const phone = business.brand.phone?.trim() || null;
  const website = getBrandWebsiteUrl();
  const instagram = getBrandInstagramUrl();
  const google = getGoogleWriteReviewUrl() || getGoogleProfileUrl();
  const bookAgain = getBookAgainUrl();
  const concern = siteUrl("/contact?topic=concern");

  const itemRows = groupChargeItems(receiptItems(charge, appointment.petName), snapshot?.pets.map(pet => ({ id: pet.appointmentId, petName: pet.petName })))
    .flatMap(group => group.items.map((item, index) => {
      if (!group.petName) return moneyRow(item.label, item.amount);
      return `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:${INK};font-size:16px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(index === 0 ? group.petName : "")}</td><td style="padding:4px 10px 4px 0;color:${INK};font-size:16px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(item.label)}</td>${moneyCell(escapeHtml(formatChargeMoney(item.amount)), "16px")}</tr>`;
    })).join("");
  const tipRow =
    charge.tipAmount > 0 ? moneyRow("Gratuity", charge.tipAmount) : "";

  const appointmentBlock =
    appointmentDate || appointmentTime
      ? `${sectionLabel("Appointment")}${
          appointmentDate
            ? `<p style="margin:0 0 4px;color:${INK};font-size:16px;line-height:1.6;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(appointmentDate)}</p>`
            : ""
        }${
          appointmentTime
            ? `<p style="margin:0;color:${INK};font-size:16px;line-height:1.6;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(appointmentTime)}</p>`
            : ""
        }`
      : "";

  const petBlock = petName
    ? `${sectionLabel("Pet")}<p style="margin:0;color:${INK};font-size:16px;line-height:1.6;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(petName)}</p>`
    : "";

  const extras = [
    paymentDate ? `Payment date: ${paymentDate}` : null,
    paymentMethodLabel ? `Payment method: ${paymentMethodLabel}` : null,
  ].filter(Boolean) as string[];

  const buttonRows = [
    google ? emailButton(google, "Leave A Review") : null,
    emailButton(bookAgain, "Book Again"),
    instagram ? emailButton(instagram, "Instagram") : null,
    emailButton(website, "Website"),
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your K9 Atelier receipt</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${EMAIL_FONT_FAMILY};font-size:16px;">
  <div style="background:${PAGE};padding:32px 16px;font-family:${EMAIL_FONT_FAMILY};">
    <div style="max-width:560px;margin:0 auto;background:${CARD};border-radius:8px;overflow:hidden;font-family:${EMAIL_FONT_FAMILY};">
      <div style="height:1px;background:${LAVENDER};font-size:0;line-height:0;font-family:${EMAIL_FONT_FAMILY};">&nbsp;</div>
      <div style="padding:40px 28px;font-family:${EMAIL_FONT_FAMILY};">
        <div style="text-align:center;font-family:${EMAIL_FONT_FAMILY};">
          ${emailLogoImg({ display: "block" })}
        </div>
        <div style="margin-top:40px;color:${INK};font-family:${EMAIL_FONT_FAMILY};">
          <p style="margin:0 0 32px;font-size:16px;line-height:1.6;text-align:left;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(thankYouLine(petName))}</p>
          ${
            appointmentBlock
              ? `<div style="margin:0 0 32px;font-family:${EMAIL_FONT_FAMILY};">${appointmentBlock}</div>`
              : ""
          }
          ${petBlock ? `<div style="margin:0 0 32px;font-family:${EMAIL_FONT_FAMILY};">${petBlock}</div>` : ""}
          <div style="margin:0 0 32px;font-family:${EMAIL_FONT_FAMILY};">
            ${sectionLabel("Service summary")}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:${EMAIL_FONT_FAMILY};font-size:16px;">
              ${itemRows}${tipRow}
            </table>
          </div>
          <div style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};padding:16px 0;margin:0 0 16px;font-family:${EMAIL_FONT_FAMILY};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:${EMAIL_FONT_FAMILY};font-size:16px;">
              ${moneyRow("TOTAL PAID", charge.total, true, 2)}
            </table>
          </div>
          ${
            paymentStatus
              ? `<p style="margin:0 0 16px;color:${MUTED};font-size:16px;line-height:1.6;font-family:${EMAIL_FONT_FAMILY};">Payment status: ${escapeHtml(paymentStatus)}</p>`
              : ""
          }
          ${extras
            .map(
              (line) =>
                `<p style="margin:0 0 8px;color:${MUTED};font-size:16px;line-height:1.6;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(line)}</p>`,
            )
            .join("")}
        </div>
        <div style="margin-top:48px;text-align:center;font-family:${EMAIL_FONT_FAMILY};">
          <p style="margin:0;color:${INK};font-size:20px;letter-spacing:3px;font-family:${EMAIL_FONT_FAMILY};">K9 ATELIER</p>
          ${
            phone
              ? `<p style="margin:12px 0 0;color:${MUTED};font-size:16px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(phone)}</p>`
              : ""
          }
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:20px;font-family:${EMAIL_FONT_FAMILY};font-size:16px;">
          ${buttonRows.join("")}
        </table>
        <p style="margin:20px 0 0;text-align:center;font-family:${EMAIL_FONT_FAMILY};font-size:16px;">
          <a href="${escapeHtml(concern)}" style="color:${LAVENDER};font-size:14px;font-family:${EMAIL_FONT_FAMILY};">File a Concern</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildChargeReceiptCardText(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
  paymentMethodLabel?: string | null,
) {
  const snapshot = charge.billSnapshot;
  const petName = receiptPetNames(appointment, charge);
  const items = groupChargeItems(receiptItems(charge, appointment.petName), snapshot?.pets.map(pet => ({id:pet.appointmentId,petName:pet.petName})));
  const refunded = charge.refundedAmount ?? 0;
  return [
    thankYouLine(petName), "", "APPOINTMENT",
    formatReceiptDate(snapshot?.serviceDate ?? appointment.appointmentDate),
    snapshot?.arrivalLabel || formatReceiptServiceTime(appointment),
    "", "PET", petName, "", "SERVICE SUMMARY",
    ...items.flatMap(group => group.items.map((item, index) =>
      [index === 0 ? group.petName : "", item.label, formatChargeMoney(item.amount)].filter(Boolean).join("  "))),
    charge.tipAmount > 0 ? "Gratuity  " + formatChargeMoney(charge.tipAmount) : null,
    "TOTAL PAID  " + formatChargeMoney(charge.total),
    "Payment status: " + receiptPaymentStatus(charge),
    charge.paidAt ? "Payment date: " + formatReceiptPaymentDate(charge.paidAt, appointment.timezone) : null,
    paymentMethodLabel || snapshot?.paymentMethodLabel ? "Payment method: " + (paymentMethodLabel || snapshot?.paymentMethodLabel) : null,
    refunded > 0 ? "Refunded  " + formatChargeMoney(refunded) : null,
    refunded > 0 ? "Remaining  " + formatChargeMoney(charge.total - refunded) : null,
    "", "K9 ATELIER", business.brand.phone,
    "Leave A Review: " + (getGoogleWriteReviewUrl() || getGoogleProfileUrl()),
    "Book Again: " + getBookAgainUrl(),
    getBrandInstagramUrl() ? "Instagram: " + getBrandInstagramUrl() : null,
    "Website: " + getBrandWebsiteUrl(),
    "File a Concern: " + siteUrl("/contact?topic=concern"),
  ].filter(line => line != null).join("\n");
}
