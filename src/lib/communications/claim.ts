import type { StoredCommunicationLog } from "@/lib/communications/types";
import { COMMUNICATION_CLAIM_STALE_MS } from "@/lib/communications/types";

export type ClaimDecision =
  | { type: "insert" }
  | {
      type: "send_existing";
      log: StoredCommunicationLog;
    }
  | {
      type: "duplicate_accepted";
      log: StoredCommunicationLog;
    }
  | { type: "in_flight"; log: StoredCommunicationLog }
  | { type: "terminal_skip"; log: StoredCommunicationLog };

function isFreshPending(log: StoredCommunicationLog, now: number, staleMs: number) {
  const claimedAt = Date.parse(log.claimedAt);
  if (Number.isNaN(claimedAt)) return true;
  return now - claimedAt < staleMs;
}

/**
 * Decide whether this worker may send.
 * Accepted rows and fresh pending rows block a second send.
 * Failed rows and stale pending rows may be claimed again without
 * changing the stored snapshot.
 */
export function decideClaim(
  existing: StoredCommunicationLog | null,
  now = Date.now(),
  staleMs = COMMUNICATION_CLAIM_STALE_MS,
): ClaimDecision {
  if (!existing) return { type: "insert" };

  if (
    existing.providerMessageId ||
    existing.status === "accepted" ||
    existing.status === "delivered" ||
    existing.status === "undelivered" ||
    existing.status === "bounced"
  ) {
    return { type: "duplicate_accepted", log: existing };
  }

  if (existing.status === "pending") {
    if (isFreshPending(existing, now, staleMs)) {
      return { type: "in_flight", log: existing };
    }
    return { type: "send_existing", log: existing };
  }

  if (existing.status === "failed") {
    return { type: "send_existing", log: existing };
  }

  if (
    existing.status === "skipped" &&
    existing.skipReason === "missing_config"
  ) {
    return { type: "send_existing", log: existing };
  }

  return { type: "terminal_skip", log: existing };
}
