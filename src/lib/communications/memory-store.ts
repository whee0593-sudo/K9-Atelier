import { randomUUID } from "node:crypto";
import type {
  ClaimResult,
  CommunicationLogStatus,
  CommunicationSnapshot,
  CommunicationStore,
} from "@/lib/communications/store";

type Row = {
  id: string;
  claimToken: string;
  status: CommunicationLogStatus;
  providerCalledAt: string | null;
  providerMessageId: string | null;
  snapshot: CommunicationSnapshot;
};

type Alert = { id: string; code: string; message: string; idempotencyKeyHash: string };

export type MemoryStoreFaults = {
  claimFailures: number;
  alertFailures: number;
  completeFailures: number;
};

/**
 * In-memory stand-in for communication_logs. Claims are serialized so two
 * overlapping sends cannot both pass the provider gate.
 */
export function createMemoryCommunicationStore(
  faults: MemoryStoreFaults = {
    claimFailures: 0,
    alertFailures: 0,
    completeFailures: 0,
  },
): CommunicationStore & { rows: () => Row[]; alerts: () => Alert[] } {
  const rows = new Map<string, Row>();
  const alerts: Alert[] = [];
  let tail: Promise<void> = Promise.resolve();

  function exclusive<T>(fn: () => T): Promise<T> {
    const run = tail.then(() => fn());
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function terminalDuplicate(row: Row): ClaimResult | null {
    if (
      row.status === "accepted" ||
      row.status === "delivered" ||
      row.status === "undelivered" ||
      row.status === "bounced" ||
      row.status === "skipped"
    ) {
      return { action: "duplicate" };
    }
    if (row.status === "uncertain" || row.providerCalledAt) {
      return { action: "unresolved" };
    }
    return null;
  }

  return {
    rows: () => [...rows.values()],
    alerts: () => [...alerts],
    claim(snapshot) {
      return exclusive(() => {
        if (faults.claimFailures > 0) {
          faults.claimFailures -= 1;
          throw new Error("communication log claim failed");
        }
        const existing = rows.get(snapshot.idempotencyKey);
        if (existing) {
          if (
            existing.providerCalledAt ||
            existing.status === "uncertain" ||
            existing.status === "accepted" ||
            existing.status === "delivered" ||
            existing.status === "undelivered" ||
            existing.status === "bounced"
          ) {
            return terminalDuplicate(existing) ?? { action: "unresolved" };
          }
          if (snapshot.intendedStatus === "skipped") return { action: "recorded" };
          if (
            existing.status === "skipped" ||
            (existing.status === "pending" && !existing.providerCalledAt)
          ) {
            existing.status = "pending";
            existing.providerCalledAt = new Date().toISOString();
            existing.claimToken = randomUUID();
            return {
              action: "send",
              id: existing.id,
              claimToken: existing.claimToken,
            };
          }
          return { action: "unresolved" };
        }

        const row: Row = {
          id: randomUUID(),
          claimToken: randomUUID(),
          status: snapshot.intendedStatus,
          providerCalledAt:
            snapshot.intendedStatus === "pending"
              ? new Date().toISOString()
              : null,
          providerMessageId: null,
          snapshot,
        };
        rows.set(snapshot.idempotencyKey, row);
        if (snapshot.intendedStatus === "skipped") return { action: "recorded" };
        return { action: "send", id: row.id, claimToken: row.claimToken };
      });
    },
    complete(input) {
      return exclusive(() => {
        if (faults.completeFailures > 0) {
          faults.completeFailures -= 1;
          return false;
        }
        const row = [...rows.values()].find((entry) => entry.id === input.id);
        if (!row || row.claimToken !== input.claimToken) return false;
        row.status = input.status;
        row.providerMessageId = input.providerMessageId;
        return true;
      });
    },
    recordAlert(input) {
      return exclusive(() => {
        if (faults.alertFailures > 0) {
          faults.alertFailures -= 1;
          return false;
        }
        if (
          alerts.some(
            (alert) =>
              alert.code === input.code &&
              alert.idempotencyKeyHash === input.idempotencyKeyHash,
          )
        ) {
          return true;
        }
        alerts.push({
          id: randomUUID(),
          code: input.code,
          message: input.message,
          idempotencyKeyHash: input.idempotencyKeyHash,
        });
        return true;
      });
    },
    listAlerts(code) {
      return exclusive(() =>
        alerts
          .filter((alert) => alert.code === code)
          .map((alert) => ({ id: alert.id, message: alert.message })),
      );
    },
    deleteAlert(id) {
      return exclusive(() => {
        const index = alerts.findIndex((alert) => alert.id === id);
        if (index >= 0) alerts.splice(index, 1);
      });
    },
  };
}
