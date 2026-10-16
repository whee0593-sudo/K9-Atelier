import { createHash } from "node:crypto";

export function merchantIdempotencyKey(input: {
  channel: "email" | "sms";
  notificationType: string;
  visitId: string;
  recipient: string;
  fingerprint?: string | null;
}) {
  const parts = [
    input.channel,
    input.notificationType,
    "staff",
    `visit:${input.visitId}`,
    `recipient:${input.recipient.trim().toLowerCase()}`,
  ];
  if (input.fingerprint) parts.push(`fp:${input.fingerprint}`);
  return parts.join("|");
}

/** Short hash stored on alerts. The raw recipient and body stay out of that table. */
export function idempotencyKeyHash(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}
