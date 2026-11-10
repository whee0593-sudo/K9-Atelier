import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export {
  CUSTOMER_CONFIRM_TTL_MS,
  customerConfirmExpiryIso,
  customerConfirmPath,
  isAwaitingCustomerConfirm,
  isCustomerConfirmExpired,
} from "@/lib/staff/customer-confirm-status";

export function hashCustomerConfirmToken(token: string) {
  return createHash("sha256").update(token.trim().toLowerCase()).digest("hex");
}

export function createCustomerConfirmToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    hash: hashCustomerConfirmToken(token),
  };
}

// Derive a separate reminder link without storing plaintext or replacing the
// original booking link. Clearing the original hash revokes both links.
export function createCustomerReminderToken(id: string, date: string, originalHash: string) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;
  const signature = createHmac("sha256", secret)
    .update(`customer-reminder:${id}:${date}:${originalHash}`)
    .digest("hex").slice(0, 32);
  return id.replaceAll("-", "") + signature;
}

export function customerReminderAppointmentId(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  return token.slice(0, 32).replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
}

export function matchesCustomerReminderToken(token: string, id: string, date: string, originalHash: string | null | undefined) {
  const expected = originalHash && createCustomerReminderToken(id, date, originalHash);
  return Boolean(expected && customerReminderAppointmentId(token) &&
    timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex")));
}
