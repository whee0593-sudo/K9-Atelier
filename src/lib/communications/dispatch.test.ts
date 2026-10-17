import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { safeAlertMessage } from "@/lib/communications/alerts";
import { decideClaim } from "@/lib/communications/claim";
import { buildCommunicationContext } from "@/lib/communications/context";
import { dispatchCommunication } from "@/lib/communications/dispatch";
import { communicationSnapshotAsText } from "@/lib/communications/html";
import { createMemoryCommunicationLogStore } from "@/lib/communications/memory-store";
import { redactCommunicationSecrets } from "@/lib/communications/redact";
import { isCommunicationAccepted } from "@/lib/communications/result";
import type { CommunicationLogStore } from "@/lib/communications/store";
import {
  COMMUNICATION_LOG_STATUS_UPDATE_FAILED,
  COMMUNICATION_LOG_WRITE_FAILED,
  COMMUNICATION_PENDING_EXPIRED,
  COMMUNICATION_PROVIDER_ID_MISSING,
  COMMUNICATION_SEND_HELD,
  type CommunicationSnapshot,
  type StoredCommunicationLog,
} from "@/lib/communications/types";

const NOW = new Date("2026-10-09T14:00:00.000Z");

function context(fingerprint = "once") {
  return buildCommunicationContext({
    notificationType: "en_route",
    recipient: "+15615550100",
    customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    visitId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    appointmentIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    petIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
    fingerprint,
  });
}

function input(
  store: CommunicationLogStore,
  patch: Partial<Parameters<typeof dispatchCommunication>[0]> = {},
) {
  return {
    channel: "sms" as const,
    provider: "twilio" as const,
    recipient: "+15615550100",
    subject: null,
    bodyText: "K9 ATELIER: Penny is on the way.",
    bodyHtml: null,
    configured: true,
    recipientValid: true,
    context: context(),
    now: NOW,
    store,
    send: async () => ({ outcome: "accepted" as const, providerMessageId: "SM123" }),
    ...patch,
  };
}

describe("communication dispatch", () => {
  const errors: string[] = [];
  const originalError = console.error;

  afterEach(() => {
    console.error = originalError;
    errors.length = 0;
  });

  it("stores the snapshot before the provider call and keeps the provider id", async () => {
    const store = createMemoryCommunicationLogStore();
    let seenStatus = "";
    const result = await dispatchCommunication(
      input(store, {
        send: async (snapshot) => {
          const row = store.rows()[0];
          seenStatus = row?.status ?? "";
          assert.equal(row?.snapshot.bodyText, snapshot.bodyText);
          assert.equal(snapshot.bodyText, "K9 ATELIER: Penny is on the way.");
          return { outcome: "accepted", providerMessageId: "SM123" };
        },
      }),
    );

    assert.equal(seenStatus, "pending");
    assert.equal(result.status, "accepted");
    assert.equal(result.providerMessageId, "SM123");
    assert.equal(isCommunicationAccepted(result), true);
    const saved = store.rows()[0];
    assert.equal(saved.status, "accepted");
    assert.equal(saved.providerMessageId, "SM123");
    assert.equal(saved.snapshot.customerId, context().customerId);
    assert.deepEqual(saved.snapshot.appointmentIds, context().appointmentIds);
  });

  it("keeps a failed provider attempt distinct from a skipped send", async () => {
    const store = createMemoryCommunicationLogStore();
    const failed = await dispatchCommunication(
      input(store, {
        send: async () => ({ outcome: "rejected", errorMessage: "Twilio 400" }),
      }),
    );
    assert.equal(failed.status, "failed");
    assert.equal(failed.skipReason, null);
    assert.equal(failed.errorMessage, "Twilio 400");
    assert.equal(store.rows()[0]?.status, "failed");

    const missing = await dispatchCommunication(
      input(store, {
        configured: false,
        context: context("missing"),
        send: async () => {
          throw new Error("provider must not be called");
        },
      }),
    );
    assert.equal(missing.status, "skipped");
    assert.equal(missing.skipReason, "missing_config");

    const invalid = await dispatchCommunication(
      input(store, {
        recipientValid: false,
        context: context("invalid"),
        send: async () => {
          throw new Error("provider must not be called");
        },
      }),
    );
    assert.equal(invalid.status, "skipped");
    assert.equal(invalid.skipReason, "invalid_recipient");
    assert.notEqual(failed.status, missing.status);
    assert.notEqual(missing.skipReason, invalid.skipReason);
  });

  it("still sends when the log write fails and records an admin alert", async () => {
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    let providerCalls = 0;
    const alerts: string[] = [];
    const store: CommunicationLogStore = {
      async claim() {
        return { action: "log_failed", error: "connection refused" };
      },
      async markAccepted() {
        return { ok: true };
      },
      async markFailed() {
        return { ok: true };
      },
      async markUncertain() {
        return { ok: true };
      },
      async recordAlert(alert) {
        alerts.push(alert.code);
        return { ok: true };
      },
      async read() {
        return null;
      },
    };

    const result = await dispatchCommunication(
      input(store, {
        context: buildCommunicationContext({
          notificationType: "appointment_submitted",
          recipient: "owner@example.com",
          allowSendWithoutSnapshot: true,
        }),
        send: async () => {
          providerCalls += 1;
          return { outcome: "accepted", providerMessageId: "SM999" };
        },
      }),
    );

    assert.equal(providerCalls, 1);
    assert.equal(result.status, "accepted");
    assert.equal(result.providerMessageId, "SM999");
    assert.match(result.logError ?? "", /connection refused/);
    assert.deepEqual(alerts, [COMMUNICATION_LOG_WRITE_FAILED]);
    assert.match(errors.join("\n"), /COMMUNICATION_LOG_WRITE_FAILED/);
  });

  it("does not send a second message after the first was accepted", async () => {
    const store = createMemoryCommunicationLogStore();
    let providerCalls = 0;
    const send = async () => {
      providerCalls += 1;
      return { outcome: "accepted" as const, providerMessageId: "SM123" };
    };
    const first = await dispatchCommunication(input(store, { send }));
    const second = await dispatchCommunication(
      input(store, {
        bodyText: "A later template must not replace the snapshot.",
        send,
      }),
    );

    assert.equal(first.status, "accepted");
    assert.equal(second.status, "duplicate");
    assert.equal(second.duplicateReason, "already_accepted");
    assert.equal(second.providerMessageId, "SM123");
    assert.equal(providerCalls, 1);
    assert.equal(store.rows()[0]?.snapshot.bodyText, "K9 ATELIER: Penny is on the way.");
    assert.equal(isCommunicationAccepted(second), true);
  });

  it("retries a failed send with the stored snapshot, not a new template", async () => {
    const store = createMemoryCommunicationLogStore();
    const bodies: string[] = [];
    const first = await dispatchCommunication(
      input(store, {
        send: async (snapshot) => {
          bodies.push(snapshot.bodyText);
          return { outcome: "rejected", errorMessage: "400 invalid number" };
        },
      }),
    );
    const second = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 60_000),
        bodyText: "Updated price: $180",
        send: async (snapshot) => {
          bodies.push(snapshot.bodyText);
          return { outcome: "accepted", providerMessageId: "SM124" };
        },
      }),
    );

    assert.equal(first.status, "failed");
    assert.equal(second.status, "accepted");
    assert.deepEqual(bodies, [
      "K9 ATELIER: Penny is on the way.",
      "K9 ATELIER: Penny is on the way.",
    ]);
    assert.equal(store.rows().length, 1);
    assert.equal(store.rows()[0]?.providerMessageId, "SM124");
  });

  it("lets only one concurrent worker send", async () => {
    const memory = createMemoryCommunicationLogStore();
    let claims = 0;
    let bothClaimsSettled: (() => void) | undefined;
    const claimsSettled = new Promise<void>((resolve) => {
      bothClaimsSettled = resolve;
    });
    const store: CommunicationLogStore = {
      claim: async (value) => {
        const result = await memory.claim(value);
        claims += 1;
        if (claims === 2) bothClaimsSettled?.();
        return result;
      },
      markAccepted: (value) => memory.markAccepted(value),
      markFailed: (value) => memory.markFailed(value),
      markUncertain: (value) => memory.markUncertain(value),
      recordAlert: (value) => memory.recordAlert(value),
      read: (logId) => memory.read(logId),
    };
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = 0;
    const send = async () => {
      entered += 1;
      if (entered === 1) await gate;
      return { outcome: "accepted" as const, providerMessageId: "SM1" };
    };
    const first = dispatchCommunication(input(store, { send }));
    const second = dispatchCommunication(input(store, { send }));
    await claimsSettled;
    release?.();
    const [a, b] = await Promise.all([first, second]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, ["accepted", "duplicate"]);
    assert.equal(entered, 1);
    assert.equal(
      [a, b].find((result) => result.status === "duplicate")?.duplicateReason,
      "in_flight",
    );
  });

  it("redacts credentials before storage and leaves confirm links in the staff-only snapshot", async () => {
    const store = createMemoryCommunicationLogStore();
    const secretBody = [
      "Card 4242424242424242",
      "key sk_live_abc123",
      "Bearer super-secret-token",
      "https://k9atelier.com/confirm-account?token=abc123",
    ].join("\n");
    let handedToProvider = "";
    await dispatchCommunication(
      input(store, {
        channel: "email",
        provider: "resend",
        subject: "Confirm sk_test_shouldhide",
        bodyText: secretBody,
        bodyHtml: `<p>${secretBody}</p>`,
        send: async (snapshot) => {
          handedToProvider = `${snapshot.subject}\n${snapshot.bodyText}\n${snapshot.bodyHtml}`;
          return { outcome: "accepted", providerMessageId: "re_email_1" };
        },
      }),
    );

    const saved = store.rows()[0]?.snapshot;
    assert.match(saved?.bodyText ?? "", /confirm-account\?token=abc123/);
    assert.doesNotMatch(saved?.bodyText ?? "", /4242424242424242/);
    assert.doesNotMatch(saved?.bodyText ?? "", /sk_live_abc123/);
    assert.doesNotMatch(saved?.bodyHtml ?? "", /Bearer super-secret-token/);
    assert.doesNotMatch(saved?.subject ?? "", /sk_test_shouldhide/);
    assert.equal(
      handedToProvider.includes("4242424242424242"),
      false,
    );
    assert.match(handedToProvider, /confirm-account\?token=abc123/);
  });

  it("alerts when a provider accepts a message without an id", async () => {
    const store = createMemoryCommunicationLogStore();
    const result = await dispatchCommunication(
      input(store, {
        send: async () => ({ outcome: "accepted", providerMessageId: null }),
      }),
    );
    assert.equal(result.status, "accepted");
    assert.equal(result.providerMessageId, null);
    assert.equal(store.alerts()[0]?.code, COMMUNICATION_PROVIDER_ID_MISSING);
  });

  it("alerts when the status update fails after the provider accepts", async () => {
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    const memory = createMemoryCommunicationLogStore();
    const store: CommunicationLogStore = {
      claim: (value) => memory.claim(value),
      read: (logId) => memory.read(logId),
      recordAlert: (alert) => memory.recordAlert(alert),
      async markAccepted() {
        return { ok: false, error: "status update failed" };
      },
      async markFailed() {
        return { ok: false, error: "status update failed" };
      },
      async markUncertain() {
        return { ok: true };
      },
    };
    const result = await dispatchCommunication(input(store));
    assert.equal(result.status, "accepted");
    assert.match(result.logError ?? "", /status update failed/);
    assert.equal(memory.alerts()[0]?.code, COMMUNICATION_LOG_STATUS_UPDATE_FAILED);
    assert.match(errors.join("\n"), /COMMUNICATION_LOG_STATUS_UPDATE_FAILED/);
  });
});

describe("uncertain provider results and visit identity", () => {
  it("does not resend after a timeout, 408, 409, or 5xx", async () => {
    const store = createMemoryCommunicationLogStore();
    let calls = 0;
    const send = async () => {
      calls += 1;
      return { outcome: "uncertain" as const, errorMessage: "500 upstream" };
    };
    const first = await dispatchCommunication(input(store, { send }));
    const second = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 10 * 60 * 1000),
        bodyText: "A later retry must not call the provider again.",
        send,
      }),
    );
    assert.equal(first.status, "uncertain");
    assert.equal(second.status, "uncertain");
    assert.equal(calls, 1);
    assert.equal(store.rows()[0]?.status, "uncertain");
    assert.equal(
      store.rows()[0]?.snapshot.bodyText,
      "K9 ATELIER: Penny is on the way.",
    );
  });

  it("does not resend when the provider accepted but the status write failed", async () => {
    const memory = createMemoryCommunicationLogStore();
    const store: CommunicationLogStore = {
      claim: (value) => memory.claim(value),
      read: (logId) => memory.read(logId),
      recordAlert: (alert) => memory.recordAlert(alert),
      async markAccepted() {
        return { ok: false, error: "status update failed" };
      },
      markFailed: (value) => memory.markFailed(value),
      markUncertain: (value) => memory.markUncertain(value),
    };
    let calls = 0;
    const send = async () => {
      calls += 1;
      return { outcome: "accepted" as const, providerMessageId: "SM555" };
    };
    const first = await dispatchCommunication(input(store, { send }));
    const second = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 10 * 60 * 1000),
        send,
      }),
    );
    assert.equal(first.status, "accepted");
    assert.equal(first.providerMessageId, "SM555");
    assert.equal(second.status, "uncertain");
    assert.equal(calls, 1);
  });

  it("retries a definite rejection with the stored snapshot", async () => {
    const store = createMemoryCommunicationLogStore();
    const bodies: string[] = [];
    await dispatchCommunication(
      input(store, {
        context: context("rejected-once"),
        send: async (snapshot) => {
          bodies.push(snapshot.bodyText);
          return { outcome: "rejected", errorMessage: "400 invalid number" };
        },
      }),
    );
    await dispatchCommunication(
      input(store, {
        context: context("rejected-once"),
        now: new Date(NOW.getTime() + 60_000),
        bodyText: "Updated copy must not replace the snapshot.",
        send: async (snapshot) => {
          bodies.push(snapshot.bodyText);
          return { outcome: "accepted", providerMessageId: "SM777" };
        },
      }),
    );
    assert.deepEqual(bodies, [
      "K9 ATELIER: Penny is on the way.",
      "K9 ATELIER: Penny is on the way.",
    ]);
  });

  it("keeps one visit notification when dog ids differ", async () => {
    const store = createMemoryCommunicationLogStore();
    let calls = 0;
    const send = async () => {
      calls += 1;
      return { outcome: "accepted" as const, providerMessageId: "re_visit" };
    };
    const visit = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const firstKey = buildCommunicationContext({
      notificationType: "appointment_reschedule",
      recipient: "owner@example.com",
      visitId: visit,
      appointmentIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      fingerprint: "mon|9am>tue|9am",
      dedupe: "visit",
    });
    const secondKey = buildCommunicationContext({
      notificationType: "appointment_reschedule",
      recipient: "owner@example.com",
      visitId: visit,
      appointmentIds: [
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ],
      fingerprint: "mon|9am>tue|9am",
      dedupe: "visit",
    });
    assert.equal(firstKey.idempotencyKey, secondKey.idempotencyKey);
    await dispatchCommunication(
      input(store, {
        channel: "email",
        provider: "resend",
        recipient: "owner@example.com",
        subject: "Updated visit",
        context: firstKey,
        send,
      }),
    );
    const again = await dispatchCommunication(
      input(store, {
        channel: "email",
        provider: "resend",
        recipient: "owner@example.com",
        subject: "Updated visit",
        context: secondKey,
        send,
      }),
    );
    assert.equal(calls, 1);
    assert.equal(again.status, "duplicate");
    assert.equal(again.duplicateReason, "already_accepted");
  });

  it("keeps A to B to A reschedules as different events", () => {
    const visit = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const toB = buildCommunicationContext({
      notificationType: "appointment_reschedule",
      recipient: "owner@example.com",
      visitId: visit,
      fingerprint: "mon|9am>tue|11am",
      dedupe: "visit",
    });
    const backToA = buildCommunicationContext({
      notificationType: "appointment_reschedule",
      recipient: "owner@example.com",
      visitId: visit,
      fingerprint: "tue|11am>mon|9am",
      dedupe: "visit",
    });
    assert.notEqual(toB.idempotencyKey, backToA.idempotencyKey);
  });

  it("still sends one appointment-scoped message per dog", () => {
    const visit = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const daisy = buildCommunicationContext({
      notificationType: "followup",
      recipient: "+15615550100",
      visitId: visit,
      appointmentIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    });
    const milo = buildCommunicationContext({
      notificationType: "followup",
      recipient: "+15615550100",
      visitId: visit,
      appointmentIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
    });
    assert.notEqual(daisy.idempotencyKey, milo.idempotencyKey);
  });
});

describe("provider http classification", () => {
  it("treats timeout, 408, 409, and 5xx as uncertain", async () => {
    const { classifyProviderHttpStatus } = await import(
      "@/lib/communications/provider-outcome"
    );
    assert.equal(classifyProviderHttpStatus(200), "accepted");
    assert.equal(classifyProviderHttpStatus(400), "rejected");
    assert.equal(classifyProviderHttpStatus(408), "uncertain");
    assert.equal(classifyProviderHttpStatus(409), "uncertain");
    assert.equal(classifyProviderHttpStatus(500), "uncertain");
    assert.equal(classifyProviderHttpStatus(0), "uncertain");
  });
});

describe("communication snapshot helpers", () => {
  it("escapes HTML so a snapshot cannot execute as markup", () => {
    const text = communicationSnapshotAsText({
      bodyText: "Hello",
      bodyHtml: `<script>alert("x")</script>`,
    });
    assert.match(text, /&lt;script&gt;/);
    assert.doesNotMatch(text, /<script>/);
  });

  it("redacts Twilio account sids and webhook secrets", () => {
    const accountSid = `AC${"0123456789abcdef".repeat(2)}`;
    const webhookSecret = `whsec_${"abc123"}`;
    const value = redactCommunicationSecrets(`${accountSid} ${webhookSecret}`);
    assert.equal(value.includes(accountSid), false);
    assert.equal(value.includes(webhookSecret), false);
  });

  it("does not resend a fresh pending claim", () => {
    const log: StoredCommunicationLog = {
      id: "1",
      snapshot: {
        channel: "sms",
        provider: "twilio",
        notificationType: "en_route",
        audience: "customer",
        customerId: null,
        visitId: null,
        appointmentIds: [],
        petIds: [],
        recipient: "+15615550100",
        subject: null,
        bodyText: "stored",
        bodyHtml: null,
        replyTo: null,
        idempotencyKey: "key",
      } satisfies CommunicationSnapshot,
      status: "pending",
      skipReason: null,
      providerMessageId: null,
      claimToken: "claim",
      claimedAt: NOW.toISOString(),
      errorMessage: null,
    };
    assert.equal(decideClaim(log, NOW.getTime()).type, "in_flight");
    assert.equal(
      decideClaim(log, NOW.getTime() + 3 * 60 * 1000).type,
      "hold",
    );
  });
});

describe("snapshot failure and hold alerts", () => {
  const originalError = console.error;

  afterEach(() => {
    console.error = originalError;
  });

  it("sends the first booking confirmation when the snapshot cannot be saved", async () => {
    let calls = 0;
    const result = await dispatchCommunication(
      input(failingClaimStore(), {
        context: buildCommunicationContext({
          notificationType: "appointment_submitted",
          recipient: "owner@example.com",
          allowSendWithoutSnapshot: true,
        }),
        bodyText: "We received Bella. https://k9atelier.com/confirm-account?token=secret",
        send: async () => {
          calls += 1;
          return { outcome: "accepted", providerMessageId: "EM1" };
        },
      }),
    );
    assert.equal(calls, 1);
    assert.equal(result.status, "accepted");
    assert.match(result.logError ?? "", /connection refused/);
  });

  it("does not call the provider for retriggerable notices when the snapshot cannot be saved", async () => {
    const errors: string[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    for (const notificationType of [
      "receipt",
      "en_route",
      "reminder_3day",
      "rebook",
      "appointment_reschedule",
      "thank_you",
    ]) {
      let calls = 0;
      const result = await dispatchCommunication(
        input(failingClaimStore(), {
          context: buildCommunicationContext({
            notificationType,
            recipient: "owner@example.com",
            fingerprint: notificationType,
          }),
          bodyText: `Secret body for ${notificationType}`,
          bodyHtml: `<a href="https://k9atelier.com/confirm-account?token=secret">pay 4242</a>`,
          send: async () => {
            calls += 1;
            return { outcome: "accepted", providerMessageId: "SM1" };
          },
        }),
      );
      assert.equal(calls, 0, notificationType);
      assert.equal(result.status, "failed");
      assert.equal(isCommunicationAccepted(result), false);
      assert.match(result.logError ?? "", /connection refused/);
    }
    const logged = errors.join("\n");
    assert.match(logged, /COMMUNICATION_LOG_WRITE_FAILED/);
    assert.equal(logged.includes("owner@example.com"), false);
    assert.equal(logged.includes("Secret body"), false);
    assert.equal(logged.includes("token=secret"), false);
    assert.equal(logged.includes("4242"), false);
  });

  it("logs a held send again without a second provider call or a second alert row", async () => {
    const store = createMemoryCommunicationLogStore();
    const errors: string[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    let calls = 0;
    const send = async () => {
      calls += 1;
      return {
        outcome: "uncertain" as const,
        errorMessage: "408 timeout for owner@example.com https://k9atelier.com/confirm-account?token=secret",
      };
    };
    const first = await dispatchCommunication(input(store, { send }));
    const second = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 10 * 60 * 1000),
        send,
      }),
    );
    assert.equal(first.status, "uncertain");
    assert.equal(second.status, "uncertain");
    assert.equal(calls, 1);
    assert.equal(
      store.alerts().filter((alert) => alert.code === COMMUNICATION_SEND_HELD).length,
      1,
    );
    assert.equal(store.rows()[0]?.snapshot.idempotencyKey.includes("+15615550100"), true);
    const logged = errors.join("\n");
    assert.match(logged, /COMMUNICATION_SEND_HELD/);
    assert.equal(logged.includes("owner@example.com"), false);
    assert.equal(logged.includes("token=secret"), false);
    assert.equal(logged.includes("+15615550100"), false);
    assert.equal(
      store.alerts().some((alert) => alert.message.includes("token=secret")),
      false,
    );
  });

  it("alerts when a pending claim expires and keeps the idempotency key", async () => {
    const store = createMemoryCommunicationLogStore();
    const errors: string[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const pending = dispatchCommunication(
      input(store, {
        send: async () => {
          calls += 1;
          await gate;
          return { outcome: "accepted", providerMessageId: "SM1" };
        },
      }),
    );
    for (let attempt = 0; attempt < 20 && store.rows().length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const savedKey = store.rows()[0]?.snapshot.idempotencyKey;
    assert.equal(typeof savedKey, "string");
    store.rows()[0]!.claimedAt = new Date(NOW.getTime() - 3 * 60 * 1000).toISOString();
    const held = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 3 * 60 * 1000),
        send: async () => {
          calls += 1;
          return { outcome: "accepted", providerMessageId: "SM2" };
        },
      }),
    );
    const again = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 4 * 60 * 1000),
        send: async () => {
          calls += 1;
          return { outcome: "accepted", providerMessageId: "SM3" };
        },
      }),
    );
    assert.equal(held.status, "uncertain");
    assert.equal(again.status, "uncertain");
    assert.equal(calls, 1);
    assert.equal(store.rows()[0]?.snapshot.idempotencyKey, savedKey);
    assert.equal(
      store.alerts().filter((alert) => alert.code === COMMUNICATION_PENDING_EXPIRED).length,
      1,
    );
    const logged = errors.join("\n");
    assert.match(logged, /COMMUNICATION_PENDING_EXPIRED/);
    assert.equal(logged.includes("+15615550100"), false);
    release();
    await pending;
  });

  it("keeps investigation logs when the alert row cannot be written", async () => {
    const errors: string[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    const result = await dispatchCommunication(
      input(failingClaimStore(), {
        context: buildCommunicationContext({
          notificationType: "receipt",
          recipient: "owner@example.com",
          fingerprint: "charge-1",
        }),
      }),
    );
    assert.equal(result.status, "failed");
    assert.equal(isCommunicationAccepted(result), false);
    const logged = errors.join("\n");
    assert.match(logged, /COMMUNICATION_LOG_WRITE_FAILED/);
    assert.match(logged, /COMMUNICATION_ALERT_WRITE_FAILED/);
  });

  it("strips links and contact details from alert text", () => {
    const text = safeAlertMessage(
      "owner@example.com https://k9atelier.com/confirm-account?token=secret +15615550100",
    );
    assert.equal(text.includes("owner@example.com"), false);
    assert.equal(text.includes("token=secret"), false);
    assert.equal(text.includes("+15615550100"), false);
  });
});

function failingClaimStore(): CommunicationLogStore {
  return {
    async claim() {
      return { action: "log_failed", error: "connection refused" };
    },
    async markAccepted() {
      return { ok: true };
    },
    async markFailed() {
      return { ok: true };
    },
    async markUncertain() {
      return { ok: true };
    },
    async recordAlert() {
      throw new Error("database unavailable");
    },
    async read() {
      return null;
    },
  };
}
