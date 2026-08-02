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
