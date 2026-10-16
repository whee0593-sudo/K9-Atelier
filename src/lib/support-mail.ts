import { isValidEmail, type SupportChannels } from "@/lib/support-contact";

export const EMAIL_INQUIRY_NOTICE =
  "EMAIL INQUIRY — You can reply directly to this email.";

export const PHONE_AVAILABLE_NOTICE =
  "PHONE AVAILABLE — Please reply via Admin → Contact Customer (SMS preferred). Email Reply will NOT send an SMS.";

export type SupportNotificationInput = SupportChannels & {
  inquiryLabel: string;
  guestSubject: string;
  groomingPreferences: string;
  isConcern: boolean;
  customerAccountId?: string | null;
  appointmentId?: string | null;
  chargeId?: string | null;
  photoCount?: number;
  message: string;
  submittedAt: string;
};

export type SupportNotification = {
  subject: string;
  text: string;
  replyTo?: string;
};

function joinMailLines(lines: string[]) {
  return lines
    .filter((line, index, list) => line !== "" || list[index - 1] !== "")
    .join("\n");
}

function contactSubjectSuffix(channels: SupportChannels) {
  return [
    channels.phone ? `Phone: ${channels.phone}` : "",
    channels.email ? `Email: ${channels.email}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildSupportNotification(
  input: SupportNotificationInput,
): SupportNotification {
  const phone = input.phone.trim();
  const email = input.email.trim();
  const notice = phone ? PHONE_AVAILABLE_NOTICE : EMAIL_INQUIRY_NOTICE;
  const suffix = contactSubjectSuffix({ email, phone });
  const subject = input.isConcern
    ? `K9 Atelier concern (${suffix})`
    : `K9 Atelier: ${input.guestSubject} (${suffix})`;
  const photoCount = input.photoCount ?? 0;

  const text = joinMailLines([
    notice,
    "",
    input.isConcern
      ? "New private concern from k9atelier.com"
      : "New message from k9atelier.com/contact",
    "",
    phone ? `Phone: ${phone}` : "",
    email ? `Email: ${email}` : "",
    `Inquiry type: ${input.inquiryLabel}`,
    input.guestSubject ? `Subject: ${input.guestSubject}` : "",
    input.groomingPreferences
      ? `Grooming preferences & coat goals:\n${input.groomingPreferences}`
      : "",
    input.customerAccountId ? `Customer account: ${input.customerAccountId}` : "",
    input.appointmentId ? `Related appointment: ${input.appointmentId}` : "",
    input.chargeId ? `Related receipt: ${input.chargeId}` : "",
    photoCount ? `Photos attached: ${photoCount}` : "",
    `Submitted: ${input.submittedAt}`,
    "",
    "Message:",
    input.message,
  ]);

  const notification: SupportNotification = { subject, text };
  if (email && isValidEmail(email)) notification.replyTo = email;
  return notification;
}
