import { business, getBrandWebsiteLabel } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { formatAppointmentTimeRange } from "@/lib/appointments/time-label";
import type { CustomerContact } from "@/lib/email/appointment-context";
import {
  COLORS,
  buildCancelFeeCopy,
  cancelGreetingName,
  formatAppointmentDateLabel,
  formatPetNameList,
  type CancelFeeStatus,
} from "@/lib/email/cancel-confirmation";
import { escapeHtml, getEmailBrand } from "@/lib/email/layout";
import { siteUrl } from "@/lib/email/resend";

export type CancelPaymentFailureKind =
  | "declined"
  | "expired"
  | "unavailable";

export type CancelFeeFailedInput = {
  appointment: AppointmentRecord;
  customer: CustomerContact;
  petNames?: string[];
  fee: number;
  feeStatus?: CancelFeeStatus;
  paymentFailureKind?: CancelPaymentFailureKind | null;
  willAutoRetry?: boolean;
  paymentUpdateUrl?: string | null;
};

const FAILURE_REASON: Record<CancelPaymentFailureKind, string> = {
  declined: "Payment method declined.",
  expired: "Payment method expired.",
  unavailable: "Payment method unavailable.",
};

export function cancelPaymentUpdateUrl(explicit?: string | null) {
  if (explicit === null) return null;
  if (explicit?.trim()) return explicit.trim();
  return siteUrl("/account/payment");
}

export function buildCancelFeeFailedCopy(input: CancelFeeFailedInput) {
  const fee = buildCancelFeeCopy({
    fee: input.fee,
    feeStatus: "failed",
  });
  const amountLabel = fee.amountLabel;
  const outstanding = amountLabel
    ? `We were unable to process the cancellation fee of ${amountLabel} using the payment method on file. The fee remains outstanding.`
    : "We were unable to process the payment method on file.";
  const reason = input.paymentFailureKind
    ? FAILURE_REASON[input.paymentFailureKind]
    : null;
  const nextStep = input.willAutoRetry
    ? "We will automatically retry the payment. No action is needed unless the payment method has changed."
    : "Please update your payment method to complete the payment. If you need assistance, please contact us and we will be happy to help.";

  return {
    amountLabel,
    paragraphs: [outstanding, ...(reason ? [reason] : []), nextStep],
  };
}

export function buildCancelFeeFailedEmailContent(input: CancelFeeFailedInput) {
  const names = input.petNames?.length
    ? input.petNames
    : [input.appointment.petName];
  const pets = formatPetNameList(names);
  const greetingName = cancelGreetingName(input.customer);
  const dateLabel = formatAppointmentDateLabel(input.appointment.appointmentDate);
  const timeLabel = formatAppointmentTimeRange(input.appointment.appointmentTime);
  const fee = buildCancelFeeFailedCopy(input);
  const paymentUrl = cancelPaymentUpdateUrl(input.paymentUpdateUrl);
  const contactUrl = siteUrl("/contact");
  const bookUrl = siteUrl("/book");
  const primaryName = names.find((name) => name.trim())?.trim();
  const subject = primaryName
    ? `Action Needed: Cancellation Fee for ${primaryName}’s Appointment`
    : "Action Needed: Cancellation Fee for Your Canceled Appointment";

  const text = [
    `Dear ${greetingName},`,
    "",
    "Appointment Canceled",
    "",
    `Your appointment for ${pets} has been canceled.`,
    "",
    "APPOINTMENT",
    dateLabel,
    ...(timeLabel ? [timeLabel] : []),
    "",
    ...fee.paragraphs,
    "",
    paymentUrl
      ? `Update Payment Method: ${paymentUrl}`
      : `Contact K9 ATELIER: ${contactUrl}`,
    paymentUrl ? `Contact K9 ATELIER: ${contactUrl}` : null,
    `Book Another Appointment: ${bookUrl}`,
    "",
    "Warmly,",
    "K9 ATELIER",
    "Private Mobile Pet Spa · Palm Beach",
    `${business.brand.phone} · ${getBrandWebsiteLabel()}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject,
    greetingName,
    pets,
    dateLabel,
    timeLabel,
    fee,
    paymentUrl,
    contactUrl,
    bookUrl,
    text,
  };
}

function emphasizeAmount(paragraph: string, amountLabel: string | null) {
  const safe = escapeHtml(paragraph);
  if (!amountLabel) return safe;
  return safe.replace(
    escapeHtml(amountLabel),
    `<span style="font-weight:600;color:${COLORS.ink};">${escapeHtml(amountLabel)}</span>`,
  );
}

export function buildCancelFeeFailedEmailHtml(input: CancelFeeFailedInput) {
  const content = buildCancelFeeFailedEmailContent(input);
  const { logoUrl } = getEmailBrand();
  const lockup = business.brand.lockup;
  const wordmark = business.brand.wordmark;
  const timeRow = content.timeLabel
    ? `<div class="k9-fail-time" style="margin:0;font-size:16px;line-height:1.5;color:${COLORS.ink};white-space:nowrap;">${escapeHtml(content.timeLabel)}</div>`
    : "";
  const feeHtml = content.fee.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${COLORS.ink};">${emphasizeAmount(paragraph, content.fee.amountLabel)}</p>`,
    )
    .join("");
  const primaryHref = content.paymentUrl ?? content.contactUrl;
  const primaryLabel = content.paymentUrl
    ? "Update Payment Method"
    : "Contact K9 ATELIER";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(content.subject)}</title>
  <style>
    a.k9-fail-cta:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 3px; }
    a.k9-fail-link:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
    @media only screen and (max-width: 620px) {
      .k9-fail-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .k9-fail-logo { width: 52px !important; height: 52px !important; }
    }
    @media only screen and (max-width: 360px) {
      .k9-fail-time { white-space: normal !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(`Action needed: the cancellation fee for ${content.pets} remains outstanding.`)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.page};">
    <tr>
      <td align="center" class="k9-fail-pad" style="padding:32px 20px;">
        <!--[if mso]>
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:${COLORS.card};border:1px solid ${COLORS.line};box-shadow:0 8px 24px rgba(47,41,48,0.04);">
          <tr>
            <td align="center" class="k9-fail-pad" style="padding:32px 36px 20px;background-color:${COLORS.page};">
              <img class="k9-fail-logo" src="${escapeHtml(logoUrl)}" width="64" height="64" alt="${escapeHtml(business.brand.name)}" style="display:block;width:64px;height:64px;border-radius:50%;margin:0 auto 12px;border:0;"/>
              <div style="font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;letter-spacing:0.18em;color:${COLORS.ink};">${escapeHtml(wordmark)}</div>
              <div style="margin-top:8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;letter-spacing:0.04em;color:${COLORS.muted};">${escapeHtml(lockup)}</div>
            </td>
          </tr>
          <tr>
            <td style="height:1px;line-height:1px;font-size:1px;background-color:${COLORS.gold};">&nbsp;</td>
          </tr>
          <tr>
            <td class="k9-fail-pad" style="padding:32px 36px 40px;font-family:Georgia,'Times New Roman',Times,serif;color:${COLORS.ink};word-break:break-word;">
              <p style="margin:0 0 10px;font-size:16px;line-height:1.6;text-align:left;">Dear ${escapeHtml(content.greetingName)},</p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.lavender};text-align:center;">Action Needed</p>
              <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;line-height:1.3;font-weight:400;color:${COLORS.lavender};text-align:center;">Appointment Canceled</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;text-align:left;">Your appointment for ${escapeHtml(content.pets)} has been canceled.</p>
              <p style="margin:0 0 8px;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.lavender};text-align:left;">Appointment</p>
              <div style="margin:0 0 24px;padding:0 0 24px;border-bottom:1px solid ${COLORS.line};">
                <div style="margin:0;font-size:16px;line-height:1.5;color:${COLORS.ink};white-space:nowrap;">${escapeHtml(content.dateLabel)}</div>
                ${timeRow}
              </div>
              ${feeHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 20px;">
                <tr>
                  <td align="center" bgcolor="${COLORS.lavender}" style="background-color:${COLORS.lavender};border-radius:4px;">
                    <a class="k9-fail-cta" href="${escapeHtml(primaryHref)}" style="display:inline-block;min-width:220px;padding:14px 28px;font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;line-height:1.25;color:#ffffff;text-decoration:none;text-align:center;">${escapeHtml(primaryLabel)}</a>
                  </td>
                </tr>
              </table>
              ${
                content.paymentUrl
                  ? `<p style="margin:0 0 10px;font-size:16px;line-height:1.6;text-align:center;"><a class="k9-fail-link" href="${escapeHtml(content.contactUrl)}" style="color:${COLORS.lavender};text-decoration:underline;">Contact K9 ATELIER</a></p>`
                  : ""
              }
              <p style="margin:0 0 28px;font-size:16px;line-height:1.6;text-align:center;">
                <a class="k9-fail-link" href="${escapeHtml(content.bookUrl)}" style="color:${COLORS.lavender};text-decoration:underline;">Book Another Appointment</a>
              </p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:${COLORS.ink};">Warmly,</p>
              <p style="margin:8px 0 0;font-size:16px;line-height:1.5;letter-spacing:0.12em;color:${COLORS.ink};">K9 ATELIER</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(lockup)}</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(business.brand.phone)} · ${escapeHtml(getBrandWebsiteLabel())}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildCancelFeeFailedEmail(input: CancelFeeFailedInput) {
  const content = buildCancelFeeFailedEmailContent(input);
  return {
    subject: content.subject,
    text: content.text,
    html: buildCancelFeeFailedEmailHtml(input),
  };
}
