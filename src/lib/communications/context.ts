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
}): CommunicationContext {
  const audience = input.audience ?? "customer";
  const appointmentIds = unique(input.appointmentIds ?? []);
  const petIds = unique(input.petIds ?? []);
  const recipient = input.recipient.trim().toLowerCase();
  const fingerprint = input.fingerprint?.trim() || "-";
  return {
    notificationType: input.notificationType,
    audience,
    customerId: input.customerId ?? null,
    visitId: input.visitId ?? null,
    appointmentIds,
    petIds,
    idempotencyKey: [
      input.notificationType,
      audience,
      appointmentIds.slice().sort().join(",") || "-",
      recipient || "-",
      fingerprint,
    ].join("|"),
  };
}
