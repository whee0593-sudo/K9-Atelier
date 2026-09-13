export const CUSTOMER_CONFIRM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function customerConfirmExpiryIso(now = Date.now()) {
  return new Date(now + CUSTOMER_CONFIRM_TTL_MS).toISOString();
}

export function isCustomerConfirmExpired(
  expiresAt: string | null | undefined,
  now = Date.now(),
) {
  if (!expiresAt) return true;
  const parsed = Date.parse(expiresAt);
  return !Number.isFinite(parsed) || parsed <= now;
}

export function isAwaitingCustomerConfirm(row: {
  staffCreated?: boolean | null;
  staff_created?: boolean | null;
  customerConfirmTokenHash?: string | null;
  customer_confirm_token_hash?: string | null;
  status?: string | null;
}) {
  const staffCreated = row.staffCreated ?? row.staff_created ?? false;
  const hash =
    row.customerConfirmTokenHash ?? row.customer_confirm_token_hash ?? null;
  return (
    staffCreated === true &&
    Boolean(hash) &&
    (row.status == null || row.status === "pending_confirmation")
  );
}

export function customerConfirmPath(token: string) {
  return `/confirm-account?token=${encodeURIComponent(token.trim())}`;
}
