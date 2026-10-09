import { randomUUID } from "node:crypto";
import { decideClaim } from "@/lib/communications/claim";
import type { CommunicationLogStore, ClaimResult } from "@/lib/communications/store";
import type { StoredCommunicationLog } from "@/lib/communications/types";

type MemoryRow = StoredCommunicationLog;

/**
 * In-process store used by tests and as the reference claim algorithm.
 * A per-key queue keeps concurrent claims from both observing "no row".
 */
export function createMemoryCommunicationLogStore(): CommunicationLogStore & {
  rows(): MemoryRow[];
  alerts(): Array<{ code: string; message: string; logId: string | null }>;
} {
  const rows = new Map<string, MemoryRow>();
  const byKey = new Map<string, string>();
  const alerts: Array<{ code: string; message: string; logId: string | null }> =
    [];
  const tails = new Map<string, Promise<unknown>>();

  function lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  function rowFrom(id: string): MemoryRow | null {
    return rows.get(id) ?? null;
  }

  return {
    rows() {
      return [...rows.values()];
    },
    alerts() {
      return alerts;
    },
    async claim(input): Promise<ClaimResult> {
      return lock(input.snapshot.idempotencyKey, async () => {
        const existingId = byKey.get(input.snapshot.idempotencyKey);
        const existing = existingId ? rowFrom(existingId) : null;
        const decision = decideClaim(existing, input.now.getTime());

        if (decision.type === "duplicate_accepted") {
          return {
            action: "duplicate_accepted",
            logId: decision.log.id,
            providerMessageId: decision.log.providerMessageId,
          };
        }
        if (decision.type === "in_flight") {
          return { action: "in_flight", logId: decision.log.id };
        }
        if (decision.type === "terminal_skip") {
          return {
            action: "terminal_skip",
            logId: decision.log.id,
            skipReason: decision.log.skipReason,
          };
        }

        if (decision.type === "send_existing" && input.status === "skipped") {
          return {
            action: "terminal_skip",
            logId: decision.log.id,
            skipReason: input.skipReason ?? decision.log.skipReason,
          };
        }

        if (decision.type === "send_existing") {
          const nextToken = randomUUID();
          const current = rowFrom(decision.log.id);
          if (!current || current.claimToken !== decision.log.claimToken) {
            return { action: "in_flight", logId: decision.log.id };
          }
          if (current.providerMessageId) {
            return {
              action: "duplicate_accepted",
              logId: current.id,
              providerMessageId: current.providerMessageId,
            };
          }
          const updated: MemoryRow = {
            ...current,
            status: "pending",
            skipReason: null,
            errorMessage: null,
            claimToken: nextToken,
            claimedAt: input.now.toISOString(),
          };
          rows.set(updated.id, updated);
          return {
            action: "send",
            logId: updated.id,
            claimToken: nextToken,
            snapshot: updated.snapshot,
          };
        }

        const id = randomUUID();
        const created: MemoryRow = {
          id,
          snapshot: input.snapshot,
          status: input.status,
          skipReason: input.skipReason,
          providerMessageId: null,
          claimToken: randomUUID(),
          claimedAt: input.now.toISOString(),
          errorMessage: input.errorMessage,
        };
        rows.set(id, created);
        byKey.set(input.snapshot.idempotencyKey, id);
        if (input.status === "skipped") {
          return {
            action: "terminal_skip",
            logId: id,
            skipReason: input.skipReason,
          };
        }
        return {
          action: "send",
          logId: id,
          claimToken: created.claimToken,
          snapshot: created.snapshot,
        };
      });
    },
    async markAccepted(input) {
      const row = rowFrom(input.logId);
      if (!row || row.claimToken !== input.claimToken) {
        return { ok: false, error: "claim lost" };
      }
      rows.set(row.id, {
        ...row,
        status: "accepted",
        providerMessageId: input.providerMessageId,
        errorMessage: null,
        skipReason: null,
      });
      return { ok: true };
    },
    async markFailed(input) {
      const row = rowFrom(input.logId);
      if (!row || row.claimToken !== input.claimToken) {
        return { ok: false, error: "claim lost" };
      }
      rows.set(row.id, {
        ...row,
        status: "failed",
        errorMessage: input.errorMessage,
      });
      return { ok: true };
    },
    async recordAlert(input) {
      alerts.push({
        code: input.code,
        message: input.message,
        logId: input.logId,
      });
      return { ok: true };
    },
    async read(logId) {
      return rowFrom(logId);
    },
  };
}
