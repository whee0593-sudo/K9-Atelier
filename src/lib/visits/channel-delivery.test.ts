import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { deliverVisitChannels } from "@/lib/visits/channel-delivery";
import { memoryVisitNotificationStore } from "@/lib/visits/notification-ledger";
import type { ProviderDelivery } from "@/lib/visits/provider-delivery";

function scripted(steps: ProviderDelivery[]) {
  const calls: string[] = [];
  return {
    calls,
    email: async () => {
      calls.push("email");
      return steps.shift() ?? "rejected";
    },
    sms: async () => {
      calls.push("sms");
      return steps.shift() ?? "rejected";
    },
  };
}

async function sendPair(
  store: ReturnType<typeof memoryVisitNotificationStore>,
  email: () => Promise<ProviderDelivery>,
  sms: () => Promise<ProviderDelivery>,
) {
  return deliverVisitChannels({
    visitId: "visit-1",
    event: "booking_confirmation",
    store,
    email,
    sms,
  });
}

describe("independent email and SMS delivery", () => {
  it("retries only SMS after email was delivered and SMS was rejected", async () => {
    const store = memoryVisitNotificationStore();
    const calls: string[] = [];
    let smsTries = 0;
    const email = async () => {
      calls.push("email");
      return "delivered" as const;
    };
    const sms = async () => {
      calls.push("sms");
      smsTries += 1;
      return (smsTries === 1 ? "rejected" : "delivered") as ProviderDelivery;
    };

    const first = await sendPair(store, email, sms);
    const second = await sendPair(store, email, sms);

    assert.deepEqual(first, { email: "sent", sms: "failed" });
    assert.deepEqual(second, { email: "skipped", sms: "sent" });
    assert.deepEqual(calls, ["email", "sms", "sms"]);
  });

  it("retries only email after SMS was delivered and email was rejected", async () => {
    const store = memoryVisitNotificationStore();
    const calls: string[] = [];
    let emailTries = 0;
    const email = async () => {
      calls.push("email");
      emailTries += 1;
      return (emailTries === 1 ? "rejected" : "delivered") as ProviderDelivery;
    };
    const sms = async () => {
      calls.push("sms");
      return "delivered" as const;
    };

    const first = await sendPair(store, email, sms);
    const second = await sendPair(store, email, sms);

    assert.deepEqual(first, { email: "failed", sms: "sent" });
    assert.deepEqual(second, { email: "sent", sms: "skipped" });
    assert.deepEqual(calls, ["email", "sms", "email"]);
  });

  it("does not retry a channel whose provider timed out", async () => {
    const store = memoryVisitNotificationStore();
    const calls: string[] = [];
    const email = async () => {
      calls.push("email");
      return "delivered" as const;
    };
    const sms = async () => {
      calls.push("sms");
      return "uncertain" as const;
    };

    const first = await sendPair(store, email, sms);
    const second = await sendPair(store, email, sms);

    assert.equal(first.sms, "failed");
    assert.deepEqual(second, { email: "skipped", sms: "skipped" });
    assert.deepEqual(calls, ["email", "sms"]);
  });

  it("does not send the same visit twice after both channels were delivered", async () => {
    const store = memoryVisitNotificationStore();
    const sent = scripted(["delivered", "delivered", "delivered", "delivered"]);
    const first = await sendPair(store, sent.email, sent.sms);
    const second = await sendPair(store, sent.email, sent.sms);

    assert.deepEqual(first, { email: "sent", sms: "sent" });
    assert.deepEqual(second, { email: "skipped", sms: "skipped" });
    assert.deepEqual(sent.calls, ["email", "sms"]);
  });

  it("keeps the ready text tied to service end, not payment", () => {
    const checkout = readFileSync(
      path.join(process.cwd(), "src/lib/sms/checkout.ts"),
      "utf8",
    );
    assert.match(checkout, /petsReadyForCheckout/);
    assert.equal(/payment|paid|charge/i.test(checkout), false);
    const enRoute = readFileSync(
      path.join(process.cwd(), "src/lib/appointments/service.ts"),
      "utf8",
    );
    assert.match(enRoute, /planVisitEnRoute/);
    assert.match(enRoute, /runVisitNotification/);
    assert.match(enRoute, /event: "en_route"/);
  });

  it("schedules follow-up from the last completion morning, without a catch-up window", () => {
    const followUp = readFileSync(
      path.join(process.cwd(), "src/lib/followup/send.ts"),
      "utf8",
    );
    assert.match(followUp, /followUpDecision/);
    assert.match(followUp, /service_ended_at/);
    assert.equal(followUp.includes("NEXT_DAY_FOLLOWUP_CATCHUP"), false);
    assert.equal(followUp.includes('.gte("appointment_date"'), false);
  });
});
