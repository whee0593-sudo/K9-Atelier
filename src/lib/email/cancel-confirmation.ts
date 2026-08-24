import { business, getBrandWebsiteLabel } from "@/lib/business";
import { formatChargeMoney } from "@/lib/charges/money";
import type { AppointmentRecord } from "@/lib/appointments/types";
import type { CustomerContact } from "@/lib/email/appointment-context";
import { formatAppointmentTimeRange } from "@/lib/appointments/time-label";
import { escapeHtml, getEmailBrand } from "@/lib/email/layout";
import { siteUrl } from "@/lib/email/resend";

export function formatAppointmentDateLabel(date: string) {
  const parsed = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export type CancelFeeStatus = "none" | "paid" | "processing" | "failed";

export type CancelConfirmationInput = {
  appointment: AppointmentRecord;
  customer: CustomerContact;
  petNames?: string[];
  fee?: number;
  feeStatus?: CancelFeeStatus;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export const COLORS = {
  page: "#F8F4ED",
  card: "#FFFDFC",
  lavender: "#756578",
  ink: "#2F2930",
  muted: "#766F75",
  gold: "#B99A5E",
  line: "#E7DED2",
} as const;

export function formatPetNameList(names: string[]) {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return "your pet";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function cancelGreetingName(customer: CustomerContact) {
  const first = customer.firstName?.trim();
  if (first) return first;
  const full = customer.name?.trim();
  if (!full) return "Client";
  return full.split(/\s+/)[0] ?? "Client";
}

export function resolveCancelFeeStatus(
  fee: number | undefined,
  status?: CancelFeeStatus,
): CancelFeeStatus {
  if (!(typeof fee === "number") || !Number.isFinite(fee) || fee <= 0) {
    return "none";
  }
  if (status === "processing" || status === "failed" || status === "paid") {
    return status;
  }
  return "paid";
}

function cardLabel(brand?: string | null, last4?: string | null) {
  const trimmedBrand = brand?.trim();
  const trimmedLast4 = last4?.trim();
  if (!trimmedBrand || !trimmedLast4) return null;
  const displayBrand =
    trimmedBrand.charAt(0).toUpperCase() + trimmedBrand.slice(1);
  return `${displayBrand} ending in ${trimmedLast4}`;
}

export function buildCancelFeeCopy(input: {
  fee?: number;
  feeStatus?: CancelFeeStatus;
  cardBrand?: string | null;
  cardLast4?: string | null;
}) {
  const status = resolveCancelFeeStatus(input.fee, input.feeStatus);
  if (status === "none") {
    return {
      status,
      amountLabel: null,
      paragraphs: ["No cancellation fee was applied."],
    };
  }

  const amountLabel = formatChargeMoney(input.fee ?? 0);
  if (status === "processing") {
    return {
      status,
      amountLabel,
      paragraphs: [
        `A cancellation fee of ${amountLabel} is currently being processed.`,
      ],
    };
  }
  if (status === "failed") {
    return {
      status,
      amountLabel,
      paragraphs: [
        `A cancellation fee of ${amountLabel} could not be charged to the payment method on file.`,
      ],
    };
  }

  const paragraphs = [
    `In accordance with our cancellation policy, a cancellation fee of ${amountLabel} has been charged to the payment method on file.`,
  ];
  const card = cardLabel(input.cardBrand, input.cardLast4);
  if (card) {
    paragraphs.push(`The cancellation fee was charged to ${card}.`);
  }
  return { status, amountLabel, paragraphs };
}

export function buildCustomerCancelEmailContent(input: CancelConfirmationInput) {
  const names = input.petNames?.length
    ? input.petNames
    : [input.appointment.petName];
  const pets = formatPetNameList(names);
  const greetingName = cancelGreetingName(input.customer);
  const dateLabel = formatAppointmentDateLabel(input.appointment.appointmentDate);
  const timeLabel = formatAppointmentTimeRange(input.appointment.appointmentTime);
  const fee = buildCancelFeeCopy(input);
  const bookUrl = siteUrl("/book");
  const contactUrl = siteUrl("/contact");
  const singlePet = names.filter((name) => name.trim()).length === 1;
  const subject = singlePet
    ? `${names.find((name) => name.trim())?.trim()}’s Appointment Has Been Canceled`
    : "Your K9 ATELIER Appointment Has Been Canceled";

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
    `If you would like to schedule another visit, we would be delighted to care for ${pets} again.`,
    "",
    `Book Another Appointment: ${bookUrl}`,
    "",
    "If you have any questions about this cancellation or the fee, please contact us.",
    `Contact K9 ATELIER: ${contactUrl}`,
    "",
    "Warmly,",
    "K9 ATELIER",
    "Private Mobile Pet Spa · Palm Beach",
    `${business.brand.phone} · ${getBrandWebsiteLabel()}`,
  ].join("\n");

  return {
    subject,
    greetingName,
    pets,
    dateLabel,
    timeLabel,
    fee,
    bookUrl,
    contactUrl,
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

export function buildCustomerCancelEmailHtml(input: CancelConfirmationInput) {
  const content = buildCustomerCancelEmailContent(input);
  const { logoUrl } = getEmailBrand();
  const lockup = business.brand.lockup;
  const wordmark = business.brand.wordmark;
  const timeRow = content.timeLabel
    ? `<div style="margin:0;font-size:16px;line-height:1.5;color:${COLORS.ink};">${escapeHtml(content.timeLabel)}</div>`
    : "";
  const feeHtml = content.fee.paragraphs
    .map(
      (paragraph, index) =>
        `<p style="margin:${index === 0 ? "0 0 16px" : "0 0 16px"};font-size:16px;line-height:1.6;color:${COLORS.ink};">${emphasizeAmount(paragraph, content.fee.amountLabel)}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(content.subject)}</title>
  <style>
    a.k9-cancel-cta:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 3px; }
    a.k9-cancel-link:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
    @media only screen and (max-width: 620px) {
      .k9-cancel-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .k9-cancel-logo { width: 48px !important; height: 48px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(`Your appointment for ${content.pets} has been canceled.`)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.page};">
    <tr>
      <td align="center" class="k9-cancel-pad" style="padding:32px 20px;">
        <!--[if mso]>
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:${COLORS.card};border:1px solid ${COLORS.line};box-shadow:0 8px 24px rgba(47,41,48,0.04);">
          <tr>
            <td align="center" class="k9-cancel-pad" style="padding:32px 36px 20px;background-color:${COLORS.page};">
              <img class="k9-cancel-logo" src="${escapeHtml(logoUrl)}" width="56" height="56" alt="${escapeHtml(business.brand.name)}" style="display:block;width:56px;height:56px;border-radius:50%;margin:0 auto 12px;border:0;"/>
              <div style="font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;letter-spacing:0.18em;color:${COLORS.ink};">${escapeHtml(wordmark)}</div>
              <div style="margin-top:8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;letter-spacing:0.04em;color:${COLORS.muted};">${escapeHtml(lockup)}</div>
            </td>
          </tr>
          <tr>
            <td style="height:1px;line-height:1px;font-size:1px;background-color:${COLORS.gold};">&nbsp;</td>
          </tr>
          <tr>
            <td class="k9-cancel-pad" style="padding:32px 36px 40px;font-family:Georgia,'Times New Roman',Times,serif;color:${COLORS.ink};word-break:break-word;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;text-align:left;">Dear ${escapeHtml(content.greetingName)},</p>
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;line-height:1.3;font-weight:400;color:${COLORS.lavender};text-align:center;">Appointment Canceled</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;text-align:left;">Your appointment for ${escapeHtml(content.pets)} has been canceled.</p>
              <p style="margin:0 0 8px;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.lavender};text-align:left;">Appointment</p>
              <div style="margin:0 0 24px;padding:0 0 24px;border-bottom:1px solid ${COLORS.line};">
                <div style="margin:0;font-size:16px;line-height:1.5;color:${COLORS.ink};">${escapeHtml(content.dateLabel)}</div>
                ${timeRow}
              </div>
              ${feeHtml}
              <p style="margin:0 0 28px;font-size:16px;line-height:1.6;text-align:left;">If you would like to schedule another visit, we would be delighted to care for ${escapeHtml(content.pets)} again.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
                <tr>
                  <td align="center" bgcolor="${COLORS.lavender}" style="background-color:${COLORS.lavender};border-radius:4px;">
                    <a class="k9-cancel-cta" href="${escapeHtml(content.bookUrl)}" style="display:inline-block;min-width:220px;padding:14px 28px;font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;line-height:1.25;color:#ffffff;text-decoration:none;text-align:center;">Book Another Appointment</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:${COLORS.muted};text-align:left;">If you have any questions about this cancellation or the fee, please contact us.</p>
              <p style="margin:0 0 28px;font-size:16px;line-height:1.6;text-align:left;">
                <a class="k9-cancel-link" href="${escapeHtml(content.contactUrl)}" style="color:${COLORS.lavender};text-decoration:underline;">Contact K9 ATELIER</a>
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

export function buildCustomerCancelConfirmationEmail(
  input: CancelConfirmationInput,
) {
  const content = buildCustomerCancelEmailContent(input);
  return {
    subject: content.subject,
    text: content.text,
    html: buildCustomerCancelEmailHtml(input),
  };
}
