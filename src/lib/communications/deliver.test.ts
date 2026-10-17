import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliverTrackedNotice } from "@/lib/communications/deliver";
import { visitLogisticsKey } from "@/lib/communications/keys";
import { memoryClaimStore } from "@/lib/communications/store";
import type { CommunicationSnapshot } from "@/lib/communications/types";

const NOW = Date.parse("2026-09-23T14:00:00.000Z");

function snapshot(patch: Partial<CommunicationSnapshot> = {}): CommunicationSnapshot {
  const visitId = "11111111-1111-4111-8111-111111111111";
  return {
    channel: "sms",
    provider: "twilio",
    notificationType: "en_route",
    audience: "customer",
    customerId: "cust-1",
    visitId,
    appointmentIds: ["apt-1", "apt-2"],
    petIds: ["pet-1", "pet-2"],
    recipient: "+15615550100",
    subject: null,
    bodyText: "On the way",
    bodyHtml: null,
    replyTo: null,
    idempotencyKey: visitLogisticsKey(visitId, "en_route"),
    ...patch,
  };
}

describe("deliverTrackedNotice", () => {
  it("sends once and does not retry an uncertain result", async () => {
    const store = memoryClaimStore();
    let sends = 0;
    const first = await deliverTrackedNotice({
      store,
      now: NOW,
      snapshot: snapshot(),
      send: async () => {
        sends += 1;
        return { outcome: "uncertain", error: "timeout" };
      },
    });
    const second = await deliverTrackedNotice({
      store,
      now: NOW + 60_000,
      snapshot: snapshot(),
      send: async () => {
        sends += 1;
        return { outcome: "accepted", providerMessageId: "SM1" };
      },
    });
    assert.equal(first, "uncertain");
    assert.equal(second, "held");
    assert.equal(sends, 1);
    assert.equal(store.rows.size, 1);
  });

  it("retries only a definite provider rejection", async () => {
    const store = memoryClaimStore();
    const sends: string[] = [];
    const failed = await deliverTrackedNotice({
      store,
      now: NOW,
      snapshot: snapshot(),
      send: async () => {
        sends.push("reject");
        return { outcome: "failed", error: "provider rejected 400" };
      },
    });
    const retried = await deliverTrackedNotice({
      store,
      now: NOW + 60_000,
      snapshot: snapshot(),
      send: async () => {
        sends.push("accept");
        return { outcome: "accepted", providerMessageId: "SM2" };
      },
    });
    const again = await deliverTrackedNotice({
      store,
      now: NOW + 120_000,
      snapshot: snapshot(),
      send: async () => {
        sends.push("extra");
        return { outcome: "accepted", providerMessageId: "SM3" };
      },
    });
    assert.equal(failed, "failed");
    assert.equal(retried, "accepted");
    assert.equal(again, "duplicate");
    assert.deepEqual(sends, ["reject", "accept"]);
  });

  it("does not retry a stale pending row", async () => {
    const store = memoryClaimStore();
    await deliverTrackedNotice({
      store,
      now: NOW,
      snapshot: snapshot(),
      send: async () => {
        throw new Error("socket hang up");
      },
    });
    const row = [...store.rows.values()][0]!;
    row.status = "pending";
    row.claimedAt = new Date(NOW - 10 * 60 * 1000).toISOString();
    let sends = 0;
    const held = await deliverTrackedNotice({
      store,
      now: NOW,
      snapshot: snapshot(),
      send: async () => {
        sends += 1;
        return { outcome: "accepted", providerMessageId: "SM4" };
      },
    });
    assert.equal(held, "held");
    assert.equal(sends, 0);
  });

  it("keeps the logistics key on the visit, not on one dog", () => {
    const visitId = "11111111-1111-4111-8111-111111111111";
    const key = visitLogisticsKey(visitId, "checkout_ready");
    assert.equal(key, `sms|checkout_ready|customer|visit:${visitId}|-`);
    assert.equal(key.includes("apt-"), false);
  });
});
