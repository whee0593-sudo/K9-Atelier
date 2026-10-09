import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
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
  COMMUNICATION_PROVIDER_ID_MISSING,
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
    send: async () => ({ ok: true as const, providerMessageId: "SM123" }),
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
          return { ok: true, providerMessageId: "SM123" };
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
        send: async () => ({ ok: false, errorMessage: "Twilio 400" }),
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
        send: async () => {
          providerCalls += 1;
          return { ok: true, providerMessageId: "SM999" };
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
      return { ok: true as const, providerMessageId: "SM123" };
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
          return { ok: false, errorMessage: "timeout" };
        },
      }),
    );
    const second = await dispatchCommunication(
      input(store, {
        now: new Date(NOW.getTime() + 60_000),
        bodyText: "Updated price: $180",
        send: async (snapshot) => {
          bodies.push(snapshot.bodyText);
          return { ok: true, providerMessageId: "SM124" };
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
      return { ok: true as const, providerMessageId: "SM1" };
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
          return { ok: true, providerMessageId: "re_email_1" };
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
        send: async () => ({ ok: true, providerMessageId: null }),
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
    };
    const result = await dispatchCommunication(input(store));
    assert.equal(result.status, "accepted");
    assert.match(result.logError ?? "", /status update failed/);
    assert.equal(memory.alerts()[0]?.code, COMMUNICATION_LOG_STATUS_UPDATE_FAILED);
    assert.match(errors.join("\n"), /COMMUNICATION_LOG_STATUS_UPDATE_FAILED/);
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
      "send_existing",
    );
  });
});
