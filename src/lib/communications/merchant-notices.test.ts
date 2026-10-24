import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryCommunicationLogStore } from "@/lib/communications/memory-store";
import { readMerchantFromAddress } from "@/lib/communications/merchant-config";
import {
  MERCHANT_REPLAY_ALERT,
  factsFromAppointments,
  merchantVisitIsConfirmed,
  notifyMerchantVisitConfirmed,
  notifyMerchantCustomerReplyC,
  notifyMerchantVisitCancelled,
  notifyMerchantReschedule,
  notifyMerchantVisitCreated,
  notifyMerchantVisitCreatedFromAppointments,
  replayDeferredMerchantAlerts,
  type MerchantVisitFacts,
} from "@/lib/communications/merchant-notices";
import type { AppointmentRecord } from "@/lib/appointments/types";

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
  it("sends one email and one SMS per newly booked visit", async () => {
    const store = createMemoryCommunicationLogStore();
    const sent = sender();
    const bodies: string[] = [];
    const first = await notifyMerchantVisitCreated(facts(), {
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

    const again = await notifyMerchantVisitCreated(facts(), {
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

  it("sends even while an active dog is still unconfirmed", async () => {
    const store = createMemoryCommunicationLogStore();
    const sent = sender();
    const pets = facts().pets.map((pet, index) =>
      index === 1 ? { ...pet, status: "pending_confirmation" as const } : pet,
    );
    const result = await notifyMerchantVisitCreated(facts(pets), {
      store,
      env: baseEnv,
      sender: sent,
    });
    assert.deepEqual(result, { email: "accepted", sms: "accepted" });
    assert.deepEqual(sent.calls, ["email", "sms"]);
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
    const first = await notifyMerchantVisitCreated(facts(), {
      store,
      env: baseEnv,
      sender: uncertain,
    });
    const second = await notifyMerchantVisitCreated(facts(), {
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
    await notifyMerchantVisitCreated(facts(), {
      store,
      env: baseEnv,
      sender,
    });
    await notifyMerchantVisitCreated(facts(), {
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
    const missing = await notifyMerchantVisitCreated(facts(), {
      store,
      env: testEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "" }),
      sender: sent,
    });
    assert.equal(missing.email, "skipped");
    assert.equal(emails, 0);

    const ready = await notifyMerchantVisitCreated(facts(), {
      store,
      env: baseEnv,
      sender: sent,
    });
    assert.equal(ready.email, "accepted");
    assert.equal(emails, 1);
  });

  it("retries only the rejected channel", async () => {
    const store = createMemoryCommunicationLogStore();
    let emails = 0;
    let texts = 0;
    const sender = {
      email: async () => {
        emails += 1;
        return { outcome: "accepted" as const, providerMessageId: "re_email" };
      },
      sms: async () => {
        texts += 1;
        if (texts === 1) {
          return { outcome: "rejected" as const, errorMessage: "invalid" };
        }
        return { outcome: "accepted" as const, providerMessageId: "SM_retry" };
      },
    };
    await notifyMerchantVisitCreated(facts(), { store, env: baseEnv, sender });
    await notifyMerchantVisitCreated(facts(), { store, env: baseEnv, sender });
    assert.equal(emails, 1);
    assert.equal(texts, 2);

    const flipped = createMemoryCommunicationLogStore();
    let flippedEmails = 0;
    let flippedTexts = 0;
    const flippedSender = {
      email: async () => {
        flippedEmails += 1;
        if (flippedEmails === 1) {
          return { outcome: "rejected" as const, errorMessage: "invalid" };
        }
        return { outcome: "accepted" as const, providerMessageId: "re_retry" };
      },
      sms: async () => {
        flippedTexts += 1;
        return { outcome: "accepted" as const, providerMessageId: "SM_ok" };
      },
    };
    await notifyMerchantVisitCreated(facts(), {
      store: flipped,
      env: baseEnv,
      sender: flippedSender,
    });
    await notifyMerchantVisitCreated(facts(), {
      store: flipped,
      env: baseEnv,
      sender: flippedSender,
    });
    assert.equal(flippedTexts, 1);
    assert.equal(flippedEmails, 2);
  });

  it("does not retry a timed-out SMS after the email was accepted", async () => {
    const store = createMemoryCommunicationLogStore();
    let emails = 0;
    let texts = 0;
    const sender = {
      email: async () => {
        emails += 1;
        return { outcome: "accepted" as const, providerMessageId: "re_held" };
      },
      sms: async () => {
        texts += 1;
        return { outcome: "uncertain" as const, errorMessage: "timeout" };
      },
    };
    await notifyMerchantVisitCreated(facts(), { store, env: baseEnv, sender });
    await notifyMerchantVisitCreated(facts(), { store, env: baseEnv, sender });
    assert.equal(emails, 1);
    assert.equal(texts, 1);
  });

  it("leaves a pets-changed replay paused when the previous roster cannot be rebuilt", async () => {
    const alerts = [
      {
        id: "alert-1",
        message: "v=visit-1 t=merchant_visit_pets_changed c=email fp=old=>new",
      },
    ];
    let emails = 0;
    const result = await replayDeferredMerchantAlerts({
      env: baseEnv,
      store: createMemoryCommunicationLogStore(),
      sender: {
        email: async () => {
          emails += 1;
          return { outcome: "accepted", providerMessageId: "re_pets" };
        },
        sms: async () => ({ outcome: "accepted", providerMessageId: "SM_pets" }),
      },
      listAlerts: async (code) =>
        code === MERCHANT_REPLAY_ALERT ? alerts : [],
      deleteAlert: async (id) => {
        const index = alerts.findIndex((alert) => alert.id === id);
        if (index >= 0) alerts.splice(index, 1);
      },
      loadVisit: async () => facts(),
    });
    assert.equal(emails, 0);
    assert.deepEqual(result, { replayed: 0, kept: 1 });
    assert.equal(alerts.length, 1);
  });
});

function historicalAppointment(id: string, visitId: string | null = null): AppointmentRecord {
  return {
    id,
    customerId: "cust-1",
    petId: "pet-1",
    petName: "Lychee",
    petBreed: "Poodle",
    serviceId: "svc-1",
    serviceName: "Full Groom",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "1 Main St",
    addressCity: "West Palm Beach",
    addressState: "FL",
    addressZip: "33401",
    travelDistanceMiles: 0,
    travelFee: 0,
    appointmentDate: "2026-10-16",
    appointmentTime: "9:00 AM",
    scheduledStart: 540,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 80,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: "2026-10-01T12:00:00.000Z",
    customerConfirmedAt: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    visitId,
  };
}

describe("historical appointments without a visit", () => {
  it("notifies one old appointment and does not merge several", async () => {
    const store = createMemoryCommunicationLogStore();
    const sent = sender();
    const one = historicalAppointment("apt-old");
    const factsForOne = factsFromAppointments([one], {
      customerName: "Sarah",
      replyTo: "sarah@example.com",
    });
    assert.equal(factsForOne?.visitId, null);
    assert.equal(
      factsFromAppointments([
        one,
        historicalAppointment("apt-other"),
      ]),
      null,
    );

    const first = await notifyMerchantVisitCreatedFromAppointments([one], {
      customerName: "Sarah",
      replyTo: "sarah@example.com",
    }, { store, env: baseEnv, sender: sent });
    const again = await notifyMerchantVisitCreatedFromAppointments([one], {
      customerName: "Sarah",
      replyTo: "sarah@example.com",
    }, { store, env: baseEnv, sender: sent });

    assert.deepEqual(first, { email: "accepted", sms: "accepted" });
    assert.deepEqual(again, { email: "duplicate", sms: "duplicate" });
    assert.deepEqual(sent.calls, ["email", "sms"]);
    const key = store.rows()[0]?.snapshot.idempotencyKey ?? "";
    assert.match(key, /apt-old/);
    assert.equal(key.includes("visit:"), false);
    assert.equal(store.rows()[0]?.snapshot.visitId, null);
  });
});

 it("emails once on subsequent confirmation without another SMS", async () => {
  const store = createMemoryCommunicationLogStore();
  const sent = sender();
  const deps = { store, env: baseEnv, sender: sent };
  await notifyMerchantVisitCreated(facts(), deps);
  assert.deepEqual(await notifyMerchantVisitConfirmed(facts(), deps), { email: "accepted", sms: "skipped" });
  assert.deepEqual(await notifyMerchantVisitConfirmed(facts(), deps), { email: "duplicate", sms: "skipped" });
  assert.deepEqual(sent.calls, ["email", "sms", "email"]);
 });

it("uses the live provider adapters when no test sender is supplied", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.RESEND_API_KEY;
  const requests: string[] = [];
  process.env.RESEND_API_KEY = "re_test";
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ id: "email-id", sid: "sms-id" }), { status: 200 });
  };
  try {
    const result = await notifyMerchantVisitCreated(facts(), {
      store: createMemoryCommunicationLogStore(), env: baseEnv,
    });
    assert.deepEqual(result, { email: "accepted", sms: "accepted" });
    assert.equal(requests.length, 2);
    assert.match(requests[0]!, /api.resend.com/);
    assert.match(requests[1]!, /api.twilio.com/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

it("deduplicates confirmation across link and SMS reply", async () => {
  const sent = sender();
  const deps = { store: createMemoryCommunicationLogStore(), env: baseEnv, sender: sent };
  await notifyMerchantVisitConfirmed(facts(), deps);
  await notifyMerchantCustomerReplyC({
    visitId: "visit-1", customerId: "cust-1", appointmentId: "apt-1",
    petId: "pet-1", petName: "Lychee", serviceName: "Full Groom",
    whenLabel: facts().whenLabel, addressLabel: facts().addressLabel,
  }, deps);
  assert.deepEqual(sent.calls, ["email"]);
});

it("sends email and SMS once per cancellation or reschedule", async () => {
  const sent = sender();
  const deps = { store: createMemoryCommunicationLogStore(), env: baseEnv, sender: sent };
  await notifyMerchantVisitCancelled(facts(), deps);
  await notifyMerchantVisitCancelled(facts(), deps);
  const moved = { ...facts(), previousWhenLabel: "Monday 9 AM", fingerprint: "Monday=>Tuesday" };
  await notifyMerchantReschedule("completed", moved, deps);
  await notifyMerchantReschedule("completed", moved, deps);
  await notifyMerchantReschedule("completed", { ...moved, fingerprint: "Tuesday=>Wednesday" }, deps);
  assert.deepEqual(sent.calls, ["email", "sms", "email", "sms", "email", "sms"]);
});
