import { business } from "@/lib/business";

export const STAFF_SMS_MAX_CHARS = 1200;
const SMS_OPT_OUT = "Reply STOP to opt out.";

function publicUrl(path: string) {
  const base = business.brand.website?.replace(/\/$/, "") ?? "https://k9atelier.com";
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix === "/" ? "" : suffix}`;
}

export function buildStudioIntroSms() {
  return [
    "K9 ATELIER: Thank you for calling. We're taking care of a guest and unable to answer at the moment.",
    "",
    "Reserve an appointment:",
    publicUrl("/book"),
    "",
    "Send us a message:",
    publicUrl("/contact"),
    "",
    "You may also reply with your pet's name, breed, age, weight, coat condition, and preferred appointment date. We'll get back to you as soon as we're available.",
    "",
    SMS_OPT_OUT,
  ].join("\n");
}

export type StudioUnknownCaller = {
  phone: string;
  calledAt: string;
  introSentAt: string | null;
};

export type StaffSmsRecipient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  canText: boolean;
};

export function buildStaffCustomerSms(message: string) {
  const trimmed = message.trim();
  const withPrefix = /^k9 atelier\b/i.test(trimmed)
    ? trimmed
    : `K9 ATELIER: ${trimmed}`;
  if (/reply stop/i.test(withPrefix)) return withPrefix;
  return `${withPrefix}\n\n${SMS_OPT_OUT}`;
}
