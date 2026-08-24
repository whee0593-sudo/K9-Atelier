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
} from "@/lib/charges/receipt-view";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { escapeHtml, getEmailBrand } from "@/lib/email/layout";
import { getCatalogItemDisplayLabel } from "@/lib/service-display";
import { siteUrl } from "@/lib/email/resend";

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

function moneyRow(label: string, amount: number, emphasize = false) {
  const size = emphasize ? "18px" : "16px";
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:${INK};font-size:${size};line-height:1.6;">${escapeHtml(label)}</td>
    <td style="padding:4px 0;color:${INK};font-size:${size};line-height:1.6;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${escapeHtml(formatChargeMoney(amount))}</td>
  </tr>`;
}

function sectionLabel(label: string) {
  return `<p style="margin:0 0 10px;color:${LAVENDER};font-size:11px;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(label)}</p>`;
}

function emailButton(href: string, label: string) {
  return `<tr>
    <td align="center" style="padding:4px 0;">
      <a href="${escapeHtml(href)}" style="display:block;max-width:264px;margin:0 auto;background:#6b596e;border-radius:8px;color:#FFFDFC;text-decoration:none;text-align:center;padding:12px 8px;font-size:13px;">${escapeHtml(label)}</a>
    </td>
  </tr>`;
}

export function buildChargeReceiptCardHtml(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
  paymentMethodLabel?: string | null,
) {
  const { logoUrl } = getEmailBrand();
  const petName = appointment.petName?.trim() || null;
  const appointmentDate = formatReceiptDate(appointment.appointmentDate);
  const appointmentTime = formatReceiptServiceTime(appointment);
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

  const itemRows = charge.lineItems
    .map((item) =>
      moneyRow(getCatalogItemDisplayLabel(item.catalogId, item.label), item.amount),
    )
    .join("");
  const tipRow =
    charge.tipAmount > 0 ? moneyRow("Gratuity", charge.tipAmount) : "";

  const appointmentBlock =
    appointmentDate || appointmentTime
      ? `${sectionLabel("Appointment")}${
          appointmentDate
            ? `<p style="margin:0 0 4px;color:${INK};font-size:16px;line-height:1.6;">${escapeHtml(appointmentDate)}</p>`
            : ""
        }${
          appointmentTime
            ? `<p style="margin:0;color:${INK};font-size:16px;line-height:1.6;">${escapeHtml(appointmentTime)}</p>`
            : ""
        }`
      : "";

  const petBlock = petName
    ? `${sectionLabel("Pet")}<p style="margin:0;color:${INK};font-size:16px;line-height:1.6;">${escapeHtml(petName)}</p>`
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
<body style="margin:0;padding:0;background:${PAGE};">
  <div style="background:${PAGE};padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:560px;margin:0 auto;background:${CARD};border-radius:8px;overflow:hidden;">
      <div style="height:1px;background:${LAVENDER};font-size:0;line-height:0;">&nbsp;</div>
      <div style="padding:40px 28px;">
        <div style="text-align:center;">
          <img src="${logoUrl}" width="72" height="72" alt="${escapeHtml(business.brand.name)}" style="display:block;margin:0 auto;"/>
          <p style="margin:16px 0 0;color:${LAVENDER};font-size:22px;letter-spacing:3px;">${escapeHtml(business.brand.name)}</p>
          <p style="margin:12px 0 0;color:${LAVENDER};font-size:12px;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(business.brand.lockup)}</p>
        </div>
        <div style="margin-top:40px;color:${INK};font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 32px;font-size:16px;line-height:1.6;text-align:left;">${escapeHtml(thankYouLine(petName))}</p>
          ${
            appointmentBlock
              ? `<div style="margin:0 0 32px;">${appointmentBlock}</div>`
              : ""
          }
          ${petBlock ? `<div style="margin:0 0 32px;">${petBlock}</div>` : ""}
          <div style="margin:0 0 32px;">
            ${sectionLabel("Service summary")}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              ${itemRows}${tipRow}
            </table>
          </div>
          <div style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};padding:16px 0;margin:0 0 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              ${moneyRow("TOTAL PAID", charge.total, true)}
            </table>
          </div>
          ${
            paymentStatus
              ? `<p style="margin:0 0 16px;color:${MUTED};font-size:16px;line-height:1.6;">Payment status: ${escapeHtml(paymentStatus)}</p>`
              : ""
          }
          ${extras
            .map(
              (line) =>
                `<p style="margin:0 0 8px;color:${MUTED};font-size:16px;line-height:1.6;">${escapeHtml(line)}</p>`,
            )
            .join("")}
        </div>
        <div style="margin-top:48px;text-align:center;font-family:Georgia,'Times New Roman',serif;">
          <p style="margin:0;color:${INK};font-size:20px;letter-spacing:3px;">K9 ATELIER</p>
          ${
            phone
              ? `<p style="margin:12px 0 0;color:${MUTED};font-size:16px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(phone)}</p>`
              : ""
          }
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:20px;font-family:Arial,Helvetica,sans-serif;">
          ${buttonRows.join("")}
        </table>
        <p style="margin:20px 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;">
          <a href="${escapeHtml(concern)}" style="color:${LAVENDER};font-size:14px;">Report a Concern</a>
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
) {
  const petName = appointment.petName?.trim() || null;
  const lines = [
    thankYouLine(petName),
    "",
    formatReceiptDate(appointment.appointmentDate),
    formatReceiptServiceTime(appointment),
    petName ? `Pet: ${petName}` : null,
    "",
    ...charge.lineItems.map(
      (item) =>
        `${getCatalogItemDisplayLabel(item.catalogId, item.label)}  ${formatChargeMoney(item.amount)}`,
    ),
    charge.tipAmount > 0
      ? `Gratuity  ${formatChargeMoney(charge.tipAmount)}`
      : null,
    `TOTAL PAID  ${formatChargeMoney(charge.total)}`,
    "",
    business.brand.phone,
    getBrandWebsiteUrl(),
    `Book again: ${getBookAgainUrl()}`,
  ].filter(Boolean);

  return lines.join("\n");
}
