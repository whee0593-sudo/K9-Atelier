import { business } from "@/lib/business";

/**
 * Single source of truth for the new-client deposit amount and short notice.
 * Edit the wording/amount in `content/business.json` →
 * `booking.newClientDeposit` / `booking.newClientDepositNotice`.
 */
export const newClientDeposit = business.booking.newClientDeposit;
export const newClientDepositNotice = business.booking.newClientDepositNotice;

/** Disclaimer shown under the estimated total in booking confirmations. */
export const estimateNote =
  "Please note: the price listed above is an estimate based on your dog's typical size and coat. Final pricing may vary depending on your dog's condition on the day of service — including coat matting, temperament, and cooperation level — and will always be confirmed with you before we begin.";

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
 * SMS body for a booking-success notification. New-client confirmations use the
 * welcome wording and note the $50 deposit. Kept short for text-message delivery.
 */
export function buildBookingConfirmationSms(
  details: BookingConfirmationDetails,
): string {
  const price = details.priceLabel ?? "TBD";

  const name = details.customerName ?? "there";

  if (isNewClient(details)) {
    return `Hi ${name}! Welcome to K9 Atelier. Your first appointment for ${details.petName} is confirmed for ${details.dateLabel} between ${details.timeLabel}. Est. Total: ${price}. A $${newClientDeposit} deposit has been applied and will go toward your total. We can't wait to meet ${details.petName}! Reply STOP to opt out.`;
  }

  return `Hi ${name}! This confirms your K9 Atelier appointment for ${details.petName} on ${details.dateLabel} between ${details.timeLabel}. Service: ${details.serviceName} | Est. Total: ${price}. We'll text you when we're on the way. Need to reschedule? Please give us 48 hrs notice. Reply STOP to opt out.`;
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
      details.priceLabel ? `Estimated Total: ${details.priceLabel}` : null,
      details.priceLabel ? "" : null,
      details.priceLabel ? estimateNote : null,
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
    `Estimated Total: ${details.priceLabel ?? ""}`,
    "",
    estimateNote,
    "",
    "New Client Deposit",
    `As a new client, a $${newClientDeposit} deposit will be collected to confirm your first appointment and applied toward your service total.`,
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
