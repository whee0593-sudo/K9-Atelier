import { OWNER_EMAIL } from "@/lib/staff/owner";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

/** Merchant inbox. Booking notices go here and nowhere else. */
export const MERCHANT_NOTIFY_EMAIL = OWNER_EMAIL;

const VERIFIED_DOMAIN = "@k9atelier.com";

export type MerchantFromAddress =
  | { ok: true; from: string; email: string }
  | { ok: false; reason: "missing_config" | "invalid_recipient" };

function addressPart(value: string) {
  const wrapped = value.match(/<([^>]+)>/);
  return (wrapped?.[1] ?? value).trim().toLowerCase();
}

/**
 * Sender for merchant notices. Must be a verified k9atelier.com address
 * and must not be the merchant inbox. No fallback to SUPPORT_FROM_EMAIL.
 */
export function readMerchantFromAddress(
  env: NodeJS.ProcessEnv = process.env,
): MerchantFromAddress {
  const raw = env.MERCHANT_NOTIFY_FROM_EMAIL?.trim() ?? "";
  if (!raw) return { ok: false, reason: "missing_config" };
  const email = addressPart(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "invalid_recipient" };
  }
  if (email === MERCHANT_NOTIFY_EMAIL || !email.endsWith(VERIFIED_DOMAIN)) {
    return { ok: false, reason: "invalid_recipient" };
  }
  return {
    ok: true,
    email,
    from: raw.includes("<") ? raw : `K9 Atelier <${email}>`,
  };
}

/**
 * Merchant SMS comes only from MERCHANT_NOTIFY_PHONE.
 * STAFF_VOICE_PHONE and reply-target rows are not consulted.
 */
export function readMerchantNotifyPhone(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.MERCHANT_NOTIFY_PHONE?.trim() ?? "";
  if (!raw) return null;
  return normalizePhoneToE164(raw);
}
