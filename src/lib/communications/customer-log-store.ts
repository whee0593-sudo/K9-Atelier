import { randomUUID } from "node:crypto";
import type {
  CommunicationSnapshot,
  CommunicationSkipReason,
  StoredCommunicationLog,
} from "@/lib/communications/types";

export type CommunicationClaimStore = {
  read(idempotencyKey: string): Promise<StoredCommunicationLog | null>;
  insert(log: StoredCommunicationLog): Promise<"inserted" | "conflict">;
  reopen(
    id: string,
    expectedClaimToken: string,
    next: { claimToken: string; claimedAt: string },
  ): Promise<StoredCommunicationLog | null>;
  finish(
    id: string,
    expectedClaimToken: string,
    patch: {
      status: StoredCommunicationLog["status"];
      skipReason: CommunicationSkipReason | null;
      providerMessageId: string | null;
      errorMessage: string | null;
    },
  ): Promise<boolean>;
  listRetryable(notificationType: string): Promise<StoredCommunicationLog[]>;
};

export function newCommunicationLog(
  snapshot: CommunicationSnapshot,
  now: number,
  status: StoredCommunicationLog["status"] = "pending",
  skipReason: CommunicationSkipReason | null = null,
): StoredCommunicationLog {
  return {
    id: randomUUID(),
    snapshot,
    status,
    skipReason,
    providerMessageId: null,
    claimToken: randomUUID(),
    claimedAt: new Date(now).toISOString(),
    errorMessage: null,
  };
}

export function memoryClaimStore(): CommunicationClaimStore & {
  rows: Map<string, StoredCommunicationLog>;
} {
  const rows = new Map<string, StoredCommunicationLog>();

  function findById(id: string) {
    for (const row of rows.values()) {
      if (row.id === id) return row;
    }
    return null;
  }

  return {
    rows,
    async read(idempotencyKey) {
      return rows.get(idempotencyKey) ?? null;
    },
    async insert(log) {
      if (rows.has(log.snapshot.idempotencyKey)) return "conflict";
      rows.set(log.snapshot.idempotencyKey, log);
      return "inserted";
    },
    async reopen(id, expectedClaimToken, next) {
      const current = findById(id);
      if (!current || current.claimToken !== expectedClaimToken) return null;
      const updated: StoredCommunicationLog = {
        ...current,
        status: "pending",
        skipReason: null,
        providerMessageId: null,
        errorMessage: null,
        claimToken: next.claimToken,
        claimedAt: next.claimedAt,
      };
      rows.set(current.snapshot.idempotencyKey, updated);
      return updated;
    },
    async finish(id, expectedClaimToken, patch) {
      const current = findById(id);
      if (!current || current.claimToken !== expectedClaimToken) return false;
      rows.set(current.snapshot.idempotencyKey, { ...current, ...patch });
      return true;
    },
    async listRetryable(notificationType) {
      return [...rows.values()].filter(
        (row) =>
          row.snapshot.notificationType === notificationType &&
          (row.status === "failed" ||
            (row.status === "skipped" && row.skipReason === "missing_config")),
      );
    },
  };
}
