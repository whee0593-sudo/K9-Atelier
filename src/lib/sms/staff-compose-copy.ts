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
    "Send an online inquiry:",
    publicUrl("/contact"),
    "",
    "Or reply with your pet's name, breed, age, weight, coat condition, and preferred appointment date. We'll get back to you as soon as we're available.",
    "",
    SMS_OPT_OUT,
  ].join("\n");
}

export function buildStudioKnownCallerSms(input: {
  firstName?: string | null;
  petNames?: string[] | null;
}) {
  const first = input.firstName?.trim() || "";
  const greeting = first
    ? `Hi ${first} — thank you for calling.`
    : "Thank you for calling.";
  const pets = (input.petNames ?? []).map((name) => name.trim()).filter(Boolean);
  const bookLine =
    pets.length === 1
      ? `You can reserve or manage ${pets[0]}'s appointment here:`
      : pets.length === 2
        ? `You can reserve or manage ${pets[0]} and ${pets[1]}'s appointments here:`
        : "You can reserve or manage your appointment here:";

  return [
    `K9 ATELIER: ${greeting} We're taking care of a guest and unable to answer at the moment.`,
    "",
    bookLine,
    publicUrl("/book"),
    "",
    "Or reply to this text and we'll get back to you as soon as we're available.",
    "",
    SMS_OPT_OUT,
  ].join("\n");
}

export function buildStudioCallerSms(
  customer?: {
    firstName?: string | null;
    petNames?: string[] | null;
  } | null,
) {
  return customer
    ? buildStudioKnownCallerSms(customer)
    : buildStudioIntroSms();
}

export type StudioUnknownCaller = {
  phone: string;
  calledAt: string;
  introSentAt: string | null;
  label?: string;
};

export type StaffSmsRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  petNames: string[];
  canText: boolean;
};

function formatListedPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone.trim() || "no mobile number";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function staffRecipientSortKey(item: StaffSmsRecipient) {
  return formatStaffRecipientLabel(item).toLowerCase();
}

export function formatStaffRecipientLabel(item: StaffSmsRecipient) {
  const pets = item.petNames.join(", ") || "—";
  const first = item.firstName.trim() || "—";
  const last = item.lastName.trim() || "—";
  const phone = item.canText ? formatListedPhone(item.phone) : "no mobile number";
  return `${pets} · ${first} · ${last} · ${phone}`;
}

export function matchesStaffRecipientSearch(
  item: StaffSmsRecipient,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  if (item.petNames.some((name) => name.toLowerCase().includes(needle))) {
    return true;
  }
  if (item.firstName.toLowerCase().includes(needle)) return true;
  if (item.lastName.toLowerCase().includes(needle)) return true;
  if (item.phone.toLowerCase().includes(needle)) return true;
  if (digits.length >= 3) {
    const phoneDigits = item.phone.replace(/\D/g, "");
    if (phoneDigits.includes(digits)) return true;
  }
  return false;
}

export function buildStaffCustomerSms(message: string) {
  const trimmed = message.trim();
  const withPrefix = /^k9 atelier\b/i.test(trimmed)
    ? trimmed
    : `K9 ATELIER: ${trimmed}`;
  if (/reply stop/i.test(withPrefix)) return withPrefix;
  return `${withPrefix}\n\n${SMS_OPT_OUT}`;
}
