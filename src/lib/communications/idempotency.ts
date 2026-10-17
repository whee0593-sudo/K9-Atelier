import { createHash } from "node:crypto";

/**
 * Same shape as Production `communication_idempotency_key`:
 * channel|notification_type|audience|scope|fingerprint
 * The merchant address is not part of the key.
 */
export function merchantIdempotencyKey(input: {
  channel: "email" | "sms";
  notificationType: string;
  scope: string;
  fingerprint?: string | null;
}) {
  const fingerprint = input.fingerprint?.trim() || "-";
  return [
    input.channel,
    input.notificationType,
    "staff",
    input.scope,
    fingerprint,
  ].join("|");
}

export function merchantVisitScope(visitId: string) {
  return `visit:${visitId}`;
}

/** Historical appointment that was saved before it had a visit. */
export function merchantAppointmentScope(appointmentId: string) {
  return `appointment:${appointmentId.trim().toLowerCase()}`;
}

/** Short hash stored on alerts. The raw recipient and body stay out of that table. */
export function idempotencyKeyHash(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}
