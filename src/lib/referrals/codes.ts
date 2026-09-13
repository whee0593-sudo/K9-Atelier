import { digitsOnly } from "@/lib/sms/phone";

const CODE_TOKEN = /[^A-Z0-9]+/g;
const ACCOUNT_CODE_FORMAT = /^[A-Z0-9]*[0-9]{4}(?:-\d+)?$/;

export function normalizeReferralCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(CODE_TOKEN, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function referralCodeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function phoneLastFour(phone: string) {
  const digits = digitsOnly(phone);
  if (digits.length < 4) return "";
  return digits.slice(-4);
}

export function isAccountReferralCodeFormat(code: string) {
  return ACCOUNT_CODE_FORMAT.test(normalizeReferralCode(code));
}

export function buildReferralCodeBase(input: {
  petName: string;
  phone: string;
}) {
  const last4 = phoneLastFour(input.phone);
  if (!last4) return "";
  const pet = referralCodeToken(input.petName) || "K9";
  return normalizeReferralCode(`${pet}${last4}`);
}

export function nextReferralCodeCandidate(base: string, attempt: number) {
  const normalized = normalizeReferralCode(base);
  if (attempt <= 1) return normalized;
  return `${normalized}-${attempt}`;
}

export function referralSharePath(code: string) {
  return `/book?ref=${encodeURIComponent(normalizeReferralCode(code))}`;
}
