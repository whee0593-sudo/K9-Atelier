import { createHash } from "node:crypto";
import type { CommunicationContext } from "@/lib/communications/types";

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function communicationFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function communicationHourBucket(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

export function buildCommunicationContext(input: {
  notificationType: string;
  recipient: string;
  audience?: CommunicationContext["audience"];
  customerId?: string | null;
  visitId?: string | null;
  appointmentIds?: string[];
  petIds?: string[];
  fingerprint?: string;
  /**
   * Visit scope collapses one visit notification into one send even when
   * callers pass different dog ids. Appointment scope keeps one send per dog.
   */
  dedupe?: "visit" | "appointment";
  allowSendWithoutSnapshot?: boolean;
}): CommunicationContext {
  const audience = input.audience ?? "customer";
  const appointmentIds = unique(input.appointmentIds ?? []);
  const petIds = unique(input.petIds ?? []);
  const visitId = input.visitId?.trim() || null;
  const recipient = input.recipient.trim().toLowerCase();
  const fingerprint = input.fingerprint?.trim() || "-";
  const scope =
    input.dedupe === "visit" && visitId
      ? `visit:${visitId}`
      : appointmentIds.slice().sort().join(",") || "-";
  return {
    notificationType: input.notificationType,
    audience,
    customerId: input.customerId ?? null,
    visitId,
    appointmentIds,
    petIds,
    idempotencyKey: [
      input.notificationType,
      audience,
      scope,
      recipient || "-",
      fingerprint,
    ].join("|"),
    allowSendWithoutSnapshot: input.allowSendWithoutSnapshot === true,
  };
}
