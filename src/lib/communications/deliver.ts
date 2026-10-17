import { randomUUID } from "node:crypto";
import { decideClaim } from "@/lib/communications/claim";
import {
  newCommunicationLog,
  type CommunicationClaimStore,
} from "@/lib/communications/store";
import type {
  CommunicationSnapshot,
  ProviderAttempt,
  StoredCommunicationLog,
} from "@/lib/communications/types";

export type DeliveryOutcome =
  | "accepted"
  | "duplicate"
  | "held"
  | "failed"
  | "uncertain"
  | "skipped"
  | "unrecorded";

function outcomeFromDecision(
  decision: ReturnType<typeof decideClaim>,
): DeliveryOutcome | null {
  if (decision.type === "duplicate_accepted") return "duplicate";
  if (decision.type === "in_flight" || decision.type === "hold") return "held";
  if (decision.type === "terminal_skip") return "skipped";
  return null;
}

async function reopenForSend(
  store: CommunicationClaimStore,
  log: StoredCommunicationLog,
  now: number,
) {
  return store.reopen(log.id, log.claimToken, {
    claimToken: randomUUID(),
    claimedAt: new Date(now).toISOString(),
  });
}

/**
 * Claim with decideClaim, then send at most once.
 * Uncertain, in-flight, and stale pending rows do not call the provider.
 * A definite rejection (failed) or a missing-config skip may be retried.
 * A store error does not call the provider.
 */
export async function deliverTrackedNotice(input: {
  store: CommunicationClaimStore;
  snapshot: CommunicationSnapshot;
  now?: number;
  skip?: "missing_config" | "invalid_recipient" | null;
  send?: () => Promise<ProviderAttempt>;
}): Promise<DeliveryOutcome> {
  const now = input.now ?? Date.now();
  let existing: StoredCommunicationLog | null;
  try {
    existing = await input.store.read(input.snapshot.idempotencyKey);
  } catch (error) {
    console.error("communication claim read failed:", error);
    return "unrecorded";
  }

  let decision = decideClaim(existing, now);
  const blocked = outcomeFromDecision(decision);
  if (blocked) return blocked;

  let claimed: StoredCommunicationLog | null = null;

  if (decision.type === "insert") {
    const created = newCommunicationLog(
      input.snapshot,
      now,
      input.skip ? "skipped" : "pending",
      input.skip ?? null,
    );
    let inserted: "inserted" | "conflict";
    try {
      inserted = await input.store.insert(created);
    } catch (error) {
      console.error("communication claim insert failed:", error);
      return "unrecorded";
    }
    if (inserted === "inserted") {
      if (input.skip) return "skipped";
      claimed = created;
    } else {
      try {
        existing = await input.store.read(input.snapshot.idempotencyKey);
      } catch (error) {
        console.error("communication claim reread failed:", error);
        return "unrecorded";
      }
      decision = decideClaim(existing, now);
      const raced = outcomeFromDecision(decision);
      if (raced) return raced;
      if (decision.type !== "send_existing") return "held";
    }
  }

  if (!claimed && decision.type === "send_existing") {
    if (input.skip) return "skipped";
    try {
      claimed = await reopenForSend(input.store, decision.log, now);
    } catch (error) {
      console.error("communication claim reopen failed:", error);
      return "unrecorded";
    }
    if (!claimed) return "held";
  }

  if (!claimed) return "held";
  if (!input.send) {
    await input.store
      .finish(claimed.id, claimed.claimToken, {
        status: "uncertain",
        skipReason: null,
        providerMessageId: null,
        errorMessage: "sender missing",
      })
      .catch(() => false);
    return "uncertain";
  }

  let attempt: ProviderAttempt;
  try {
    attempt = await input.send();
  } catch (error) {
    attempt = {
      outcome: "uncertain",
      error: error instanceof Error ? error.message : "provider threw",
    };
  }

  let saved = false;
  try {
    saved = await input.store.finish(claimed.id, claimed.claimToken, {
      status: attempt.outcome,
      skipReason: null,
      providerMessageId:
        attempt.outcome === "accepted" ? attempt.providerMessageId : null,
      errorMessage: attempt.outcome === "accepted" ? null : attempt.error,
    });
  } catch (error) {
    console.error("communication outcome write failed:", error);
    saved = false;
  }
  if (!saved) return "uncertain";
  return attempt.outcome;
}
