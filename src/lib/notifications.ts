import { business } from "@/lib/business";

/**
 * Single source of truth for the new-client deposit amount and short notice.
 * Edit the wording/amount in `content/business.json` →
 * `booking.newClientDeposit` / `booking.newClientDepositNotice`.
 */
export const newClientDeposit = business.booking.newClientDeposit;
export const newClientDepositNotice = business.booking.newClientDepositNotice;

export type BookingConfirmationDetails = {
  customerName?: string;
  petName: string;
  serviceName: string;
  /** Appointment date, already formatted for display. */
  dateLabel: string;
  /** Arrival window, e.g. "10:00 AM – 10:30 AM". */
  timeLabel: string;
  addressLabel?: string;
  durationLabel?: string;
  priceLabel?: string;
  /**
   * Defaults to `true` so the deposit messaging is always included in a
   * new-client confirmation. Pass `false` for returning clients.
   */
  isNewClient?: boolean;
  /** Signature name for the email closing (e.g. the groomer's name). */
  signoffName?: string;
};

function isNewClient(details: BookingConfirmationDetails) {
  return details.isNewClient !== false;
}

/** Prefer phone for contact copy, falling back to email. */
function contactMethod() {
  return business.brand.phone ?? business.brand.email;
}

/** Footer contact line, e.g. "penny@k9atelier.com | https://k9atelier.com". */
function contactFooter() {
  const parts = [business.brand.phone ?? business.brand.email];
  if (business.brand.website) parts.push(business.brand.website);
  return parts.join(" | ");
}

/**
 * SMS body for a booking-success notification. New-client confirmations note
 * the $50 deposit. Kept short for text-message delivery.
 */
export function buildBookingConfirmationSms(
  details: BookingConfirmationDetails,
): string {
  const parts = [
    `K9 Atelier: ${details.petName}'s ${details.serviceName} is confirmed for ${details.dateLabel}, ${details.timeLabel}.`,
  ];
  if (isNewClient(details)) {
    parts.push(
      `A $${newClientDeposit} new-client deposit was charged and will be applied to your appointment total.`,
    );
  }
  parts.push(`Questions? ${contactMethod()}`);
  return parts.join(" ");
}

/**
 * Email subject + body for a booking-success notification. New-client
 * confirmations use the full welcome email, including the $50 deposit section.
 */
export function buildBookingConfirmationEmail(
  details: BookingConfirmationDetails,
): { subject: string; body: string } {
  const greetingName = details.customerName ?? "there";
  const dash = "—";

  if (!isNewClient(details)) {
    const subject = `Your K9 Atelier appointment for ${details.petName} is confirmed ✓`;
    const lines = [
      `Hi ${greetingName},`,
      "",
      `Your appointment for ${details.petName} is confirmed. Here are the details:`,
      "",
      `Date: ${details.dateLabel}`,
      `Time: ${details.timeLabel}`,
      `Service: ${details.serviceName}`,
      details.addressLabel ? `Location: ${details.addressLabel}` : null,
      details.durationLabel
        ? `Estimated Duration: ${details.durationLabel}`
        : null,
      details.priceLabel ? `Total: ${details.priceLabel}` : null,
      "",
      "Need to reschedule? We kindly ask for at least 48 hours' notice for any changes. Reply to this email or contact us at " +
        `${contactMethod()}.`,
      "",
      "Warmly,",
      details.signoffName ?? business.brand.name,
      business.brand.name,
      contactFooter(),
    ];
    return { subject, body: lines.filter((l) => l !== null).join("\n") };
  }

  const subject = "Welcome to K9 Atelier — Your Appointment is Confirmed ✓";
  const lines = [
    `Hi ${greetingName},`,
    "",
    `Welcome to K9 Atelier! We're so glad you've chosen us, and we're looking forward to caring for ${details.petName} soon.`,
    "",
    "Here are your appointment details:",
    "",
    `Date: ${details.dateLabel}`,
    `Time: ${details.timeLabel}`,
    `Service: ${details.serviceName}`,
    `Location: ${details.addressLabel ?? ""}`,
    `Estimated Duration: ${details.durationLabel ?? ""}`,
    `Total: ${details.priceLabel ?? ""}`,
    "",
    "New Client Deposit",
    `As a new client, a $${newClientDeposit} deposit has been charged to the payment method provided at booking. This deposit will be fully applied toward the total cost of your appointment ${dash} it simply confirms your reservation and secures your spot on our schedule.`,
    "",
    "What to Expect",
    "Our mobile grooming studio will arrive within your scheduled window. A quick health and coat check will take place before we begin, and we'll keep you updated throughout the appointment.",
    "",
    "How to Prepare",
    `- Please ensure ${details.petName} has had a bathroom break shortly before our arrival`,
    "- A parking spot near your home for our grooming van is greatly appreciated",
    `- Please let us know in advance about any allergies, sensitivities, medical conditions, or behavioral notes for ${details.petName}`,
    "",
    "Need to Reschedule?",
    `We kindly ask for at least 48 hours' notice for any changes. You can reply directly to this email or contact us at ${contactMethod()}.`,
    "",
    `We can't wait to meet ${details.petName} and welcome you both to the K9 Atelier family!`,
    "",
    "Warmly,",
    details.signoffName ?? business.brand.name,
    business.brand.name,
    contactFooter(),
  ];

  return { subject, body: lines.join("\n") };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Branded, send-ready HTML version of the booking-success email. Uses inline
 * styles for email-client compatibility. New-client confirmations include the
 * welcome framing and the $50 deposit section.
 */
export function buildBookingConfirmationEmailHtml(
  details: BookingConfirmationDetails,
): { subject: string; html: string } {
  const c = business.colors;
  const newClient = isNewClient(details);
  const subject = newClient
    ? "Welcome to K9 Atelier — Your Appointment is Confirmed ✓"
    : `Your K9 Atelier appointment for ${details.petName} is confirmed ✓`;

  const petName = escapeHtml(details.petName);
  const greetingName = escapeHtml(details.customerName ?? "there");
  const logoUrl = business.brand.website
    ? `${business.brand.website}${business.brand.logo}`
    : business.brand.logo;

  const detailRows: Array<[string, string | undefined]> = [
    ["Date", details.dateLabel],
    ["Time", details.timeLabel],
    ["Service", details.serviceName],
    ["Location", details.addressLabel],
    ["Estimated Duration", details.durationLabel],
    ["Total", details.priceLabel],
  ];
  const detailsHtml = detailRows
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 0;color:${c.textMuted};width:150px;vertical-align:top;">${label}</td><td style="padding:4px 0;color:${c.text};font-weight:600;">${escapeHtml(value as string)}</td></tr>`,
    )
    .join("");

  const depositHtml = newClient
    ? `<div style="margin:24px 0;padding:16px 20px;background:${c.lavenderLight};border:1px solid ${c.gold};border-radius:12px;">
        <h3 style="margin:0 0 8px;color:${c.goldDark};font-size:16px;">New Client Deposit</h3>
        <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">As a new client, a $${newClientDeposit} deposit has been charged to the payment method provided at booking. This deposit will be fully applied toward the total cost of your appointment — it simply confirms your reservation and secures your spot on our schedule.</p>
      </div>`
    : "";

  const welcomeLine = newClient
    ? `We&apos;re so glad you&apos;ve chosen us, and we&apos;re looking forward to caring for ${petName} soon.`
    : `Your appointment for ${petName} is confirmed. Here are the details:`;

  const prepAndExpectHtml = newClient
    ? `<h3 style="margin:24px 0 8px;color:${c.goldDark};font-size:16px;">What to Expect</h3>
       <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">Our mobile grooming studio will arrive within your scheduled window. A quick health and coat check will take place before we begin, and we&apos;ll keep you updated throughout the appointment.</p>
       <h3 style="margin:24px 0 8px;color:${c.goldDark};font-size:16px;">How to Prepare</h3>
       <ul style="margin:0;padding-left:20px;color:${c.text};font-size:14px;line-height:1.7;">
         <li>Please ensure ${petName} has had a bathroom break shortly before our arrival</li>
         <li>A parking spot near your home for our grooming van is greatly appreciated</li>
         <li>Please let us know in advance about any allergies, sensitivities, medical conditions, or behavioral notes for ${petName}</li>
       </ul>`
    : "";

  const closingLine = newClient
    ? `<p style="margin:24px 0 0;color:${c.text};font-size:14px;line-height:1.6;">We can&apos;t wait to meet ${petName} and welcome you both to the K9 Atelier family!</p>`
    : "";

  const contactLine = escapeHtml(contactMethod());
  const footerLine = escapeHtml(contactFooter());
  const signoff = escapeHtml(details.signoffName ?? business.brand.name);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${c.cream};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.cream};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${c.lavenderLight};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px;text-align:center;background:${c.lavenderLight};">
          <img src="${logoUrl}" alt="K9 Atelier" width="64" height="64" style="border-radius:50%;display:inline-block;"/>
          <div style="margin-top:8px;font-size:20px;font-weight:700;color:${c.goldDark};letter-spacing:0.05em;">K9 Atelier</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:${c.goldDark};font-size:22px;">Your Appointment is Confirmed</h1>
          <p style="margin:0 0 8px;color:${c.text};font-size:14px;line-height:1.6;">Hi ${greetingName},</p>
          <p style="margin:0 0 20px;color:${c.text};font-size:14px;line-height:1.6;">${newClient ? "Welcome to K9 Atelier! " : ""}${welcomeLine}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;font-size:14px;">${detailsHtml}</table>
          ${depositHtml}
          ${prepAndExpectHtml}
          <h3 style="margin:24px 0 8px;color:${c.goldDark};font-size:16px;">Need to Reschedule?</h3>
          <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">We kindly ask for at least 48 hours&apos; notice for any changes. You can reply directly to this email or contact us at <a href="mailto:${business.brand.email}" style="color:${c.goldDark};">${contactLine}</a>.</p>
          ${closingLine}
          <p style="margin:24px 0 0;color:${c.text};font-size:14px;">Warmly,<br/>${signoff}</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:${c.lavenderLight};text-align:center;color:${c.textMuted};font-size:12px;">
          <div style="font-weight:600;color:${c.goldDark};">K9 Atelier</div>
          <div style="margin-top:4px;">${footerLine}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
