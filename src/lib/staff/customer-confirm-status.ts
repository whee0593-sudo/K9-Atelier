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

export const SECURE_APPOINTMENT_CARD_MESSAGE =
  "Add a card to secure this appointment. You will not be charged now.";

export function preferredPaymentMethodId(
  methods: { id: string; isDefault: boolean }[],
) {
  return methods.find((method) => method.isDefault)?.id ?? methods[0]?.id ?? null;
}

/** Expiry is inclusive through the card's expiry month in the service timezone. */
export function usableConfirmationCards<T extends { id: string; last4: string; expMonth: number; expYear: number }>(methods: T[], now = new Date()): T[] {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"numeric"}).formatToParts(now);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return methods.filter(method => Boolean(method.id) && /^\d{4}$/.test(method.last4)
    && Number.isInteger(method.expMonth) && method.expMonth >= 1 && method.expMonth <= 12
    && Number.isInteger(method.expYear) && (method.expYear > year || (method.expYear === year && method.expMonth >= month)));
}
