import { business } from "@/lib/business";
import { streetNameForSms } from "@/lib/sms/street-name";
import { formatVisitPetNames } from "@/lib/visits/pet-names";

/** Disclaimer shown under the estimated total in booking confirmations. */
export const estimateNote =
  "Please note: the price listed above is an estimate based on your dog's typical size and coat. Final pricing may vary depending on your dog's condition on the day of service — including coat matting, temperament, and cooperation level — and will always be confirmed with you before we begin.";

export type BookingConfirmationDetails = {
  customerName?: string;
  petName: string;
  /** Every dog on this visit. One name keeps the original sentence. */
  petNames?: string[];
  serviceName: string;
  /** One label per dog when a visit has more than one service. */
  serviceNames?: string[];
  /** Appointment date, already formatted for display. */
  dateLabel: string;
  /** Arrival window, e.g. "10–11 AM". */
  timeLabel: string;
  addressLabel?: string;
  /**
   * Street name only, for confirmation texts. No house number.
   * City, state, and ZIP stay out of the SMS.
   */
  streetName?: string;
  durationLabel?: string;
  priceLabel?: string;
  /**
   * Defaults to `true` so first-visit confirmations use welcome wording.
   * Pass `false` for returning clients.
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

export const smsConsentCopy =
  "By providing your mobile number, you agree to receive appointment confirmations, reminders, and service-related messages from K9 Atelier. Message and data rates may apply. Reply STOP to opt out.";

export const photoMarketingConsentCopy =
  business.booking.photoMarketingConsent;

const SMS_OPT_OUT = "Reply STOP to opt out.";

function smsGreetingName(details: BookingConfirmationDetails) {
  return details.customerName?.trim() || "there";
}

export function confirmationPetLabel(details: BookingConfirmationDetails) {
  if (details.petNames && details.petNames.length > 1) {
    return formatVisitPetNames(details.petNames, details.petName);
  }
  return details.petName;
}

export function confirmationServiceLabel(details: BookingConfirmationDetails) {
  if (details.serviceNames && details.serviceNames.length > 1) {
    return details.serviceNames.join("; ");
  }
  return details.serviceName;
}

function confirmationPetHas(details: BookingConfirmationDetails) {
  return details.petNames && details.petNames.length > 1 ? "have" : "has";
}

function confirmationSmsWhen(details: BookingConfirmationDetails) {
  const window = formatSmsTimeWindow(details.timeLabel);
  const street = streetNameForSms(details.streetName);
  if (!street) return `${details.dateLabel}, ${window}`;
  return `${details.dateLabel}, ${window}, ${street}`;
}

/**
 * Confirmation text sent with the confirmation email, and again 3 days
 * before the visit. The email keeps the full address and the previous
 * letter. The text asks the guest to reply C.
 */
export function buildCustomerAppointmentConfirmSms(
  details: BookingConfirmationDetails,
): string {
  return [
    `${confirmationPetLabel(details)}'s appointment on ${confirmationSmsWhen(details)}. Reply C to confirm.`,
    "",
    SMS_OPT_OUT,
  ].join("\n");
}

export function buildBookingConfirmationSms(
  details: BookingConfirmationDetails,
): string {
  return buildCustomerAppointmentConfirmSms(details);
}

export function buildAppointmentSubmittedSms(
  details: BookingConfirmationDetails,
): string {
  return `K9 Atelier has received your appointment request. Your selected appointment is pending confirmation. We will notify you once it is confirmed. ${SMS_OPT_OUT}`;
}

export function buildAppointmentDeclinedSms(
  details: BookingConfirmationDetails,
): string {
  const name = smsGreetingName(details);
  return `Hi ${name}, we’re unable to confirm your selected K9 Atelier appointment. You may select another available date through our booking page, or contact us for assistance. ${SMS_OPT_OUT}`;
}

export function buildAppointmentStaffCancelledSms(
  details: BookingConfirmationDetails,
): string {
  return `K9 Atelier: We’re sorry, but we’re unable to accommodate your appointment on ${details.dateLabel} between ${details.timeLabel}. You may book another available date, or contact us for assistance. ${SMS_OPT_OUT}`;
}

export function buildAppointmentReminderSms(
  details: BookingConfirmationDetails,
): string {
  const name = smsGreetingName(details);
  return `Hi ${name}! Reminder: ${confirmationPetLabel(details)}'s K9 Atelier appointment is today between ${details.timeLabel}. We'll text when we're on the way. ${SMS_OPT_OUT}`;
}

/** "9:00–11:00 AM" / "11:30 AM – 1:00 PM" → "9am to 11am" / "11:30am to 1pm". */
export function formatSmsTimeWindow(timeLabel: string) {
  const trimmed = timeLabel.trim();
  const samePeriod = trimmed.match(
    /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (samePeriod) {
    const period = samePeriod[5]!;
    return `${formatSmsClock(samePeriod[1]!, samePeriod[2]!, period)} to ${formatSmsClock(samePeriod[3]!, samePeriod[4]!, period)}`;
  }

  const bothPeriods = trimmed.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (bothPeriods) {
    return `${formatSmsClock(bothPeriods[1]!, bothPeriods[2]!, bothPeriods[3]!)} to ${formatSmsClock(bothPeriods[4]!, bothPeriods[5]!, bothPeriods[6]!)}`;
  }

  return trimmed;
}

function formatSmsClock(hourText: string, minuteText: string, period: string) {
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const suffix = period.toLowerCase();
  if (minute === 0) return `${hour}${suffix}`;
  return `${hour}:${String(minute).padStart(2, "0")}${suffix}`;
}

/** Sent 3 days before the visit at 10am. Customer replies C to confirm. */
export function buildAppointmentConfirmRequestSms(
  details: BookingConfirmationDetails,
): string {
  return buildCustomerAppointmentConfirmSms(details);
}

export function buildAppointmentEnRouteSms(
  details: BookingConfirmationDetails,
): string {
  const name = smsGreetingName(details);
  return `Hi ${name}! We're on the way for ${confirmationPetLabel(details)}'s K9 Atelier appointment. See you soon, between ${details.timeLabel}. ${SMS_OPT_OUT}`;
}

/**
 * Email subject + body for a booking-success notification. First-visit
 * confirmations use the welcome email.
 */
export function buildBookingConfirmationEmail(
  details: BookingConfirmationDetails,
): { subject: string; body: string } {
  const greetingName = details.customerName ?? "there";
  const subject = "Your Appointment Is Confirmed";

  if (!isNewClient(details)) {
    const lines = [
      `Hi ${greetingName},`,
      "",
      `Your appointment for ${confirmationPetLabel(details)} is confirmed for ${details.dateLabel} between ${details.timeLabel}.`,
      "",
      `Service: ${confirmationServiceLabel(details)}`,
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

  const lines = [
    `Hi ${greetingName},`,
    "",
    `Welcome to K9 Atelier. Your appointment for ${confirmationPetLabel(details)} is confirmed for ${details.dateLabel} between ${details.timeLabel}.`,
    "",
    "Here are your appointment details:",
    "",
    `Date: ${details.dateLabel}`,
    `Time: ${details.timeLabel}`,
    `Service: ${confirmationServiceLabel(details)}`,
    `Location: ${details.addressLabel ?? ""}`,
    `Estimated Duration: ${details.durationLabel ?? ""}`,
    `Estimated Total: ${details.priceLabel ?? ""}`,
    "",
    estimateNote,
    "",
    "Payment",
    "You are not charged when you book. Payment is settled after your appointment. Late cancellations and no-shows may be charged to the card you selected, according to our cancellation policy.",
    "",
    "What to Expect",
    "We do our best to arrive at your scheduled time, and every confirmed appointment will be completed. Because this is a mobile service, arrival time may vary due to weather, traffic, and the appointment before yours. We will text you when we are on the way. A quick health and coat check will take place before we begin.",
    "",
    "How to Prepare",
    `- Please ensure ${confirmationPetLabel(details)} ${confirmationPetHas(details)} had a bathroom break shortly before our arrival`,
    "- A parking spot near your home for our grooming van is greatly appreciated",
    `- Please let us know in advance about any allergies, sensitivities, medical conditions, or behavioral notes for ${confirmationPetLabel(details)}`,
    "",
    "Need to Reschedule?",
    `We kindly ask for at least 48 hours' notice for any changes. You can reply directly to this email or contact us at ${contactMethod()}.`,
    "",
    "Warmly,",
    details.signoffName ?? business.brand.name,
    business.brand.name,
    contactFooter(),
  ];

  return { subject, body: lines.join("\n") };
}
