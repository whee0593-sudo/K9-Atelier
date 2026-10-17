import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideClaim } from "@/lib/communications/claim";
import { COMMUNICATION_CLAIM_STALE_MS } from "@/lib/communications/types";
import type { StoredCommunicationLog } from "@/lib/communications/types";

const NOW = Date.parse("2026-09-23T14:00:00.000Z");

function log(patch: Partial<StoredCommunicationLog> = {}): StoredCommunicationLog {
  return {
    id: "log-1",
    status: "pending",
    skipReason: null,
    providerMessageId: null,
    claimToken: "token-1",
    claimedAt: new Date(NOW).toISOString(),
    errorMessage: null,
    snapshot: {
      channel: "email",
      provider: "resend",
      notificationType: "next_day_followup",
      audience: "customer",
      customerId: null,
      visitId: "visit-1",
      appointmentIds: [],
      petIds: [],
      recipient: "sarah@example.com",
      subject: "Hello",
      bodyText: "Hello",
      bodyHtml: null,
      replyTo: null,
      idempotencyKey: "email|next_day_followup|customer|visit:visit-1|-",
    },
    ...patch,
  };
}

describe("decideClaim", () => {
  it("inserts when no row exists", () => {
    assert.deepEqual(decideClaim(null, NOW), { type: "insert" });
  });

  it("treats accepted provider ids as duplicates", () => {
    for (const status of ["accepted", "delivered", "undelivered", "bounced"] as const) {
      assert.equal(decideClaim(log({ status }), NOW).type, "duplicate_accepted");
    }
    assert.equal(
      decideClaim(log({ status: "failed", providerMessageId: "re_123" }), NOW).type,
      "duplicate_accepted",
    );
  });

  it("holds uncertain and fresh or stale pending", () => {
    assert.equal(decideClaim(log({ status: "uncertain" }), NOW).type, "hold");
    assert.equal(decideClaim(log({ status: "pending" }), NOW).type, "in_flight");
    assert.equal(
      decideClaim(
        log({ claimedAt: new Date(NOW - COMMUNICATION_CLAIM_STALE_MS - 1).toISOString() }),
        NOW,
      ).type,
      "hold",
    );
  });

  it("retries a definite failure and a missing-config skip only", () => {
    assert.equal(decideClaim(log({ status: "failed" }), NOW).type, "send_existing");
    assert.equal(
      decideClaim(log({ status: "skipped", skipReason: "missing_config" }), NOW).type,
      "send_existing",
    );
    assert.equal(
      decideClaim(log({ status: "skipped", skipReason: "invalid_recipient" }), NOW).type,
      "terminal_skip",
    );
  });
});
