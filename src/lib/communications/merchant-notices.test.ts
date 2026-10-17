import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryCommunicationLogStore } from "@/lib/communications/memory-store";
import { readMerchantFromAddress } from "@/lib/communications/merchant-config";
import {
  merchantVisitIsConfirmed,
  notifyMerchantVisitConfirmed,
  type MerchantVisitFacts,
} from "@/lib/communications/merchant-notices";

function testEnv(
  patch: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <notices@k9atelier.com>",
    MERCHANT_NOTIFY_PHONE: "+15615550199",
    RESEND_API_KEY: "re_test",
    TWILIO_ACCOUNT_SID: "ACtest",
    TWILIO_AUTH_TOKEN: "token",
    TWILIO_FROM_NUMBER: "+15615933335",
    ...patch,
  };
}

const baseEnv = testEnv();

function facts(
  pets: MerchantVisitFacts["pets"] = [
    {
      appointmentId: "apt-1",
      petId: "pet-1",
      petName: "Lychee",
      serviceName: "Full Groom",
      status: "confirmed",
    },
    {
      appointmentId: "apt-2",
      petId: "pet-2",
      petName: "Otto",
      serviceName: "Bath & Brush",
      status: "confirmed",
    },
  ],
): MerchantVisitFacts {
  return {
    visitId: "visit-1",
    customerId: "cust-1",
    customerName: "Sarah",
    replyTo: "sarah@example.com",
    whenLabel: "Thursday, October 16, 9:00 AM",
    addressLabel: "1 Main St, West Palm Beach, FL 33401",
    pets,
  };
}

function sender() {
  const calls: Array<"email" | "sms"> = [];
  return {
    calls,
    email: async () => {
      calls.push("email");
      return { outcome: "accepted" as const, providerMessageId: "re_1" };
    },
    sms: async (input: { to: string; body: string }) => {
      calls.push("sms");
      return {
        outcome: "accepted" as const,
        providerMessageId: "SM1",
        body: input.body,
      };
    },
  };
}

describe("merchant from address", () => {
  it("rejects a missing, inbox, or off-domain from address", () => {
    assert.deepEqual(readMerchantFromAddress(testEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "" })), {
      ok: false,
      reason: "missing_config",
    });
    assert.equal(
      readMerchantFromAddress(
        testEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "penny@k9atelier.com" }),
      ).ok,
      false,
    );
    assert.equal(
      readMerchantFromAddress(
        testEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "studio@example.com" }),
      ).ok,
      false,
    );
    assert.equal(
      readMerchantFromAddress(
        testEnv({
          MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <notices@k9atelier.com>",
        }),
      ).ok,
      true,
    );
  });
});

describe("merchant visit confirmation", () => {
  it("sends one email and one SMS after every active dog is confirmed", async () => {
    const store = createMemoryCommunicationLogStore();
    const sent = sender();
    const bodies: string[] = [];
    const first = await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender: {
        email: sent.email,
        sms: async (input) => {
          bodies.push(input.body);
          return sent.sms(input);
        },
      },
    });
    assert.deepEqual(first, { email: "accepted", sms: "accepted" });
    assert.deepEqual(sent.calls, ["email", "sms"]);
    assert.match(bodies[0] ?? "", /Lychee and Otto/);

    const again = await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender: {
        email: sent.email,
        sms: sent.sms,
      },
    });
    assert.deepEqual(again, { email: "duplicate", sms: "duplicate" });
    assert.deepEqual(sent.calls, ["email", "sms"]);
  });

  it("does not send while any active dog is still unconfirmed", async () => {
    const store = createMemoryCommunicationLogStore();
    const sent = sender();
    const pets = facts().pets.map((pet, index) =>
      index === 1 ? { ...pet, status: "pending_confirmation" as const } : pet,
    );
    const result = await notifyMerchantVisitConfirmed(facts(pets), {
      store,
      env: baseEnv,
      sender: sent,
    });
    assert.deepEqual(result, { email: "not_confirmed", sms: "not_confirmed" });
    assert.deepEqual(sent.calls, []);
    assert.equal(merchantVisitIsConfirmed(pets), false);
  });

  it("does not retry an uncertain provider result", async () => {
    const store = createMemoryCommunicationLogStore();
    let emails = 0;
    const uncertain = {
      email: async () => {
        emails += 1;
        return { outcome: "uncertain" as const, errorMessage: "timeout" };
      },
      sms: async () => ({ outcome: "uncertain" as const, errorMessage: "timeout" }),
    };
    const first = await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender: uncertain,
    });
    const second = await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender: uncertain,
    });
    assert.equal(first.email, "uncertain");
    assert.equal(second.email, "uncertain");
    assert.equal(emails, 1);
  });

  it("retries a definite provider rejection", async () => {
    const store = createMemoryCommunicationLogStore();
    let emails = 0;
    const sender = {
      email: async () => {
        emails += 1;
        return { outcome: "rejected" as const, errorMessage: "invalid" };
      },
      sms: async () => ({ outcome: "rejected" as const, errorMessage: "invalid" }),
    };
    await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender,
    });
    await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender,
    });
    assert.equal(emails, 2);
  });

  it("skips a missing from address, then sends once the address is configured", async () => {
    const store = createMemoryCommunicationLogStore();
    let emails = 0;
    const sent = {
      email: async () => {
        emails += 1;
        return { outcome: "accepted" as const, providerMessageId: "re_2" };
      },
      sms: async () => ({
        outcome: "accepted" as const,
        providerMessageId: "SM2",
      }),
    };
    const missing = await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: testEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "" }),
      sender: sent,
    });
    assert.equal(missing.email, "skipped");
    assert.equal(emails, 0);

    const ready = await notifyMerchantVisitConfirmed(facts(), {
      store,
      env: baseEnv,
      sender: sent,
    });
    assert.equal(ready.email, "accepted");
    assert.equal(emails, 1);
  });
});
