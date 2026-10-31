import { business } from "@/lib/business";
import { streetNameForSms } from "@/lib/sms/street-name";

/** Disclaimer shown under the estimated total in booking confirmations. */
export const estimateNote =
  "Please note: the price listed above is an estimate based on your dog's typical size and coat. Final pricing may vary depending on your dog's condition on the day of service — including coat matting, temperament, and cooperation level — and will always be confirmed with you before we begin.";

export type BookingConfirmationDetails = {
  customerName?: string;
  petName: string;
  serviceName: string;
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

/** Prefer phone for contact copy, falling back to email. */
function contactMethod() {
  return business.brand.phone ?? business.brand.email;
}

export const smsConsentCopy =
  "By providing your mobile number, you agree to receive appointment confirmations, reminders, and service-related messages from K9 Atelier. Message and data rates may apply. Reply STOP to opt out.";

export const photoMarketingConsentCopy =
  business.booking.photoMarketingConsent;

const SMS_OPT_OUT = "Reply STOP to opt out.";

function smsGreetingName(details: BookingConfirmationDetails) {
  return details.customerName?.trim() || "there";
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
    `${details.petName}'s appointment on ${confirmationSmsWhen(details)}. Reply C to confirm.`,
    "",
    SMS_OPT_OUT,
  ].join("\n");
}

export function buildBookingConfirmationSms(
  details: BookingConfirmationDetails,
): string {
  const address = (details.addressLabel?.trim() || details.streetName?.trim())
    ?.replace(/,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\s*$/i, "")
    .trim();
  const when = `${details.dateLabel}, ${formatSmsTimeWindow(details.timeLabel)}`;
  return `K9 Atelier: You have an appointment for ${details.petName} on ${when}${address ? `, at ${address}` : ""}. See you then!💜 Reply to talk to Penny about anything. ${SMS_OPT_OUT}`;
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
  return `Hi ${name}! Reminder: ${details.petName}'s K9 Atelier appointment is today between ${details.timeLabel}. We'll text when we're on the way. ${SMS_OPT_OUT}`;
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
  return `Hi ${name}! We're on the way for ${details.petName}'s K9 Atelier appointment. See you soon, between ${details.timeLabel}. ${SMS_OPT_OUT}`;
}

/**
 * Email subject + body for a booking-success notification. First-visit
 * confirmations use the welcome email.
 */
export function buildBookingConfirmationEmail(
  details: BookingConfirmationDetails,
): { subject: string; body: string } {
  const greetingName = details.customerName ?? "there";
  const policyUrl = `${(business.brand.website ?? "https://k9atelier.com").replace(/\/$/, "")}/faq#cancellations-rescheduling`;
  return {
    subject: "Your Appointment Is Confirmed",
    body: [
      `Dear ${greetingName}, we look forward to caring for ${details.petName}.`,
      "",
      `Date: ${details.dateLabel}`,
      `Estimated Arrival Time: ${details.timeLabel}`,
      `Service: ${details.serviceName}`,
      `Location: ${details.addressLabel ?? ""}`,
      `Estimated duration: ${details.durationLabel ?? ""}`,
      `Estimated total: ${details.priceLabel ?? ""}`,
      "",
      "This estimate is based on your dog's typical size and coat. Final pricing may vary depending on coat condition, matting, and temperament.",
      "",
      `Cancellation Policy: ${policyUrl}`,
      "",
      "We do our best to arrive at your scheduled time, and every confirmed appointment will be completed. Because this is a mobile service, arrival time may vary due to weather, traffic, and the appointment before yours. We will text you when we are on the way.",
      "",
      "How should I prepare for my appointment?",
      "",
      `- A bathroom break for ${details.petName} shortly before our arrival is appreciated`,
      "- A nearby parking spot for our grooming van is greatly appreciated",
      "- Please let us know in advance of any allergies, sensitivities, or behavioral notes",
      "",
      `Please reply to this email or reach us at ${contactMethod()} for anything we can help with.`,
      "",
      "Warmly,",
      business.brand.name,
      "",
      `${business.brand.name} · ${business.brand.phone} · k9atelier.com`,
    ].join("\n"),
  };
}
