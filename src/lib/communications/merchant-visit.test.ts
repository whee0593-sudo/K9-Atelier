import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  notifyMerchantVisitConfirmed,
  replayMerchantVisitConfirmed,
  type MerchantVisitFacts,
} from "@/lib/communications/merchant-visit";
import { memoryClaimStore } from "@/lib/communications/store";
import type { ProviderAttempt } from "@/lib/communications/types";

const ENV = {
  MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <notices@k9atelier.com>",
  MERCHANT_NOTIFY_PHONE: "+15615550199",
};

function facts(statuses: string[]): MerchantVisitFacts {
  return {
    visitId: "22222222-2222-4222-8222-222222222222",
    customerId: "cust-1",
    customerName: "Sarah",
    replyTo: "sarah@example.com",
    whenLabel: "Wednesday, September 23, 10:00 AM",
    addressLabel: "1 Main St, West Palm Beach, FL 33401",
    pets: statuses.map((status, index) => ({
      appointmentId: `apt-${index + 1}`,
      petId: `pet-${index + 1}`,
      petName: index === 0 ? "Lychee" : "Otto",
      serviceName: "Full Groom",
      status,
    })),
  };
}

describe("merchant visit confirmation", () => {
  it("does not record or send until every active dog is confirmed", async () => {
    const store = memoryClaimStore();
    let sends = 0;
    const summary = await notifyMerchantVisitConfirmed(facts(["confirmed", "pending_confirmation"]), {
      store,
      env: ENV,
      sendEmail: async () => {
        sends += 1;
        return { outcome: "accepted", providerMessageId: "re_1" };
      },
      sendSms: async () => {
        sends += 1;
        return { outcome: "accepted", providerMessageId: "SM1" };
      },
    });
    assert.deepEqual(summary, { email: "not_confirmed", sms: "not_confirmed" });
    assert.equal(sends, 0);
    assert.equal(store.rows.size, 0);
  });

  it("sends one visit notice and does not send a second copy", async () => {
    const store = memoryClaimStore();
    let sends = 0;
    const send = async (): Promise<ProviderAttempt> => {
      sends += 1;
      return { outcome: "accepted", providerMessageId: `id-${sends}` };
    };
    const first = await notifyMerchantVisitConfirmed(facts(["confirmed", "confirmed"]), {
      store,
      env: ENV,
      sendEmail: send,
      sendSms: send,
    });
    const second = await notifyMerchantVisitConfirmed(facts(["confirmed", "cancelled"]), {
      store,
      env: ENV,
      sendEmail: send,
      sendSms: send,
    });
    assert.equal(first.email, "accepted");
    assert.equal(first.sms, "accepted");
    assert.equal(second.email, "duplicate");
    assert.equal(second.sms, "duplicate");
    assert.equal(sends, 2);
  });

  it("retries a failed notice and holds a timeout", async () => {
    const store = memoryClaimStore();
    const attempts: string[] = [];
    const failed = await notifyMerchantVisitConfirmed(facts(["confirmed"]), {
      store,
      env: ENV,
      sendEmail: async () => {
        attempts.push("reject");
        return { outcome: "failed", error: "provider rejected 422" };
      },
      sendSms: async () => {
        attempts.push("timeout");
        return { outcome: "uncertain", error: "timeout" };
      },
    });
    assert.equal(failed.email, "failed");
    assert.equal(failed.sms, "uncertain");

    const replay = await replayMerchantVisitConfirmed({
      store,
      env: ENV,
      sendEmail: async () => {
        attempts.push("retry-email");
        return { outcome: "accepted", providerMessageId: "re_2" };
      },
      sendSms: async () => {
        attempts.push("retry-sms");
        return { outcome: "accepted", providerMessageId: "SM2" };
      },
    });
    assert.equal(replay.retried, 1);
    assert.equal(attempts.includes("retry-sms"), false);
    assert.equal(attempts.includes("retry-email"), true);
  });
});
