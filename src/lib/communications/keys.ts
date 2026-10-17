import type {
  CommunicationAudience,
  CommunicationChannel,
} from "@/lib/communications/types";

/**
 * Same shape as Production `communication_idempotency_key`:
 * channel|notificationType|audience|scope|fingerprint
 * The recipient is not part of the key.
 */
export function communicationIdempotencyKey(input: {
  channel: CommunicationChannel;
  notificationType: string;
  audience: CommunicationAudience;
  scope: string;
  fingerprint?: string | null;
}) {
  const fingerprint = input.fingerprint?.trim() || "-";
  return [
    input.channel,
    input.notificationType,
    input.audience,
    input.scope,
    fingerprint,
  ].join("|");
}

export function communicationVisitScope(visitId: string) {
  return `visit:${visitId.trim().toLowerCase()}`;
}

export function visitLogisticsKey(
  visitId: string,
  notificationType: "en_route" | "checkout_ready",
) {
  return communicationIdempotencyKey({
    channel: "sms",
    notificationType,
    audience: "customer",
    scope: communicationVisitScope(visitId),
    fingerprint: "-",
  });
}
