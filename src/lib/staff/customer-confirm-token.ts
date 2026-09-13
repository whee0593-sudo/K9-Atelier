import { createHash, randomBytes } from "node:crypto";

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
