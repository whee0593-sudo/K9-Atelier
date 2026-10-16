import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBookingConfirmationEmail } from "@/lib/notifications";
import { createMemoryCommunicationStore } from "@/lib/communications/memory-store";
import { merchantIdempotencyKey } from "@/lib/communications/idempotency";
import {
  MERCHANT_NOTIFY_EMAIL,
  readMerchantFromAddress,
  readMerchantNotifyPhone,
} from "@/lib/communications/merchant-config";
import {
  buildMerchantRescheduleCopy,
  buildMerchantVisitConfirmedCopy,
  merchantVisitIsConfirmed,
  notifyMerchantReschedule,
  notifyMerchantVisitConfirmed,
  replayDeferredMerchantAlerts,
  rescheduleFingerprint,
  type MerchantVisitFacts,
} from "@/lib/communications/merchant-notices";
import type { ProviderSendResult } from "@/lib/communications/store";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function functionBody(file: string, name: string) {
  const text = source(file);
  const start = text.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, name);
  const next = text.indexOf("\nexport ", start + 10);
  return text.slice(start, next === -1 ? undefined : next);
}

function facts(overrides: Partial<MerchantVisitFacts> = {}): MerchantVisitFacts {
  return {
    visitId: "visit-1",
    customerId: "customer-1",
    customerName: "Ada Lovelace",
    replyTo: "ada@example.com",
    whenLabel: "Wednesday, November 4, 2026, 2:00 PM",
    addressLabel: "1 Palm Ave, West Palm Beach, FL 33401",
    pets: [
      {
        appointmentId: "appt-1",
        petId: "pet-1",
        petName: "Bella",
        serviceName: "Full Haircut",
        status: "confirmed",
      },
    ],
    ...overrides,
  };
}

function merchantEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <notices@k9atelier.com>",
    MERCHANT_NOTIFY_PHONE: "+15555550100",
    RESEND_API_KEY: "re_test",
    TWILIO_ACCOUNT_SID: "AC_test",
    TWILIO_AUTH_TOKEN: "token",
    TWILIO_FROM_NUMBER: "+15555550199",
    STAFF_VOICE_PHONE: "+19995550111",
    SUPPORT_FROM_EMAIL: "K9 Atelier <penny@k9atelier.com>",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

function harness(
  env = merchantEnv(),
  faults = { claimFailures: 0, alertFailures: 0, completeFailures: 0 },
) {
  const store = createMemoryCommunicationStore(faults);
  const emailCalls: Array<{ from: string; to: string; subject: string; text: string }> = [];
  const smsCalls: Array<{ to: string; body: string }> = [];
  let emailResult: ProviderSendResult = {
    outcome: "accepted",
    providerMessageId: "email-1",
  };
  let smsResult: ProviderSendResult = {
    outcome: "accepted",
    providerMessageId: "sms-1",
  };
  const sender = {
    email: async (input: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }) => {
      emailCalls.push(input);
      return emailResult;
    },
    sms: async (input: { to: string; body: string }) => {
      smsCalls.push(input);
      return smsResult;
    },
  };
  return {
    store,
    faults,
    emailCalls,
    smsCalls,
    sender,
    env,
    deps: { store, env, sender },
    setEmailResult(result: ProviderSendResult) {
      emailResult = result;
    },
    setSmsResult(result: ProviderSendResult) {
      smsResult = result;
    },
  };
}

describe("merchant notice config", () => {
  it("keeps the merchant inbox separate from the verified sender", () => {
    assert.equal(MERCHANT_NOTIFY_EMAIL, "penny@k9atelier.com");
    const from = readMerchantFromAddress(merchantEnv());
    assert.equal(from.ok, true);
    if (from.ok) {
      assert.equal(from.email, "notices@k9atelier.com");
      assert.equal(from.from, "K9 Atelier <notices@k9atelier.com>");
    }
  });

  it("rejects the inbox, another domain, and a missing sender", () => {
    assert.deepEqual(
      readMerchantFromAddress(
        merchantEnv({
          MERCHANT_NOTIFY_FROM_EMAIL: "K9 Atelier <penny@k9atelier.com>",
        }),
      ),
      { ok: false, reason: "invalid_recipient" },
    );
    assert.deepEqual(
      readMerchantFromAddress(
        merchantEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "studio@example.com" }),
      ),
      { ok: false, reason: "invalid_recipient" },
    );
    assert.deepEqual(
      readMerchantFromAddress(merchantEnv({ MERCHANT_NOTIFY_FROM_EMAIL: "" })),
      { ok: false, reason: "missing_config" },
    );
  });

  it("reads only MERCHANT_NOTIFY_PHONE", () => {
    assert.equal(readMerchantNotifyPhone(merchantEnv()), "+15555550100");
    assert.equal(
      readMerchantNotifyPhone(merchantEnv({ MERCHANT_NOTIFY_PHONE: "" })),
      null,
    );
    assert.equal(
      readMerchantNotifyPhone(
        merchantEnv({ MERCHANT_NOTIFY_PHONE: "5555550100" }),
      ),
      "+15555550100",
    );
  });
});

describe("merchant visit notices", () => {
  it("sends one email and one SMS for a confirmed visit", async () => {
    const box = harness();
    const summary = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.deepEqual(summary, { email: "accepted", sms: "accepted" });
    assert.equal(box.emailCalls.length, 1);
    assert.equal(box.smsCalls.length, 1);
    assert.equal(box.emailCalls[0]?.to, "penny@k9atelier.com");
    assert.equal(box.emailCalls[0]?.from, "K9 Atelier <notices@k9atelier.com>");
    assert.equal(box.smsCalls[0]?.to, "+15555550100");
    assert.match(box.emailCalls[0]?.text ?? "", /Bella/);
    const emailRow = box.store.rows().find((row) => row.snapshot.channel === "email");
    const smsRow = box.store.rows().find((row) => row.snapshot.channel === "sms");
    assert.equal(emailRow?.status, "accepted");
    assert.equal(smsRow?.status, "accepted");
    assert.equal(emailRow?.providerMessageId, "email-1");
    assert.notEqual(emailRow?.status, "delivered");
    assert.notEqual(smsRow?.status, "delivered");
    assert.equal(
      emailRow?.snapshot.idempotencyKey,
      merchantIdempotencyKey({
        channel: "email",
        notificationType: "merchant_visit_confirmed",
        visitId: "visit-1",
        recipient: "penny@k9atelier.com",
      }),
    );
    assert.equal(emailRow?.snapshot.idempotencyKey.includes("pet-1"), false);
  });

  it("does not send a confirmed notice while any active pet is still pending", async () => {
    const box = harness();
    const summary = await notifyMerchantVisitConfirmed(
      facts({
        pets: [
          {
            appointmentId: "appt-1",
            petId: "pet-1",
            petName: "Bella",
            serviceName: "Full Haircut",
            status: "pending_confirmation",
          },
        ],
      }),
      box.deps,
    );
    assert.equal(merchantVisitIsConfirmed([{ status: "pending_confirmation" }]), false);
    assert.deepEqual(summary, { email: "not_confirmed", sms: "not_confirmed" });
    assert.equal(box.store.rows().length, 0);
    assert.equal(box.emailCalls.length, 0);
    assert.equal(box.smsCalls.length, 0);
  });

  it("sends one notice for a multi-dog visit and ignores a repeated request", async () => {
    const box = harness();
    const visit = facts({
      pets: [
        {
          appointmentId: "appt-1",
          petId: "pet-1",
          petName: "Bella",
          serviceName: "Full Haircut",
          status: "confirmed",
        },
        {
          appointmentId: "appt-2",
          petId: "pet-2",
          petName: "Milo",
          serviceName: "Bath",
          status: "confirmed",
        },
      ],
    });
    await notifyMerchantVisitConfirmed(visit, box.deps);
    const again = await notifyMerchantVisitConfirmed(visit, box.deps);
    assert.deepEqual(again, { email: "duplicate", sms: "duplicate" });
    assert.equal(box.emailCalls.length, 1);
    assert.equal(box.smsCalls.length, 1);
    assert.match(box.emailCalls[0]?.text ?? "", /Bella/);
    assert.match(box.emailCalls[0]?.text ?? "", /Milo/);
    assert.equal(box.store.rows().length, 2);
  });

  it("does not send a second confirmed notice when another dog is added to the visit", async () => {
    const box = harness();
    await notifyMerchantVisitConfirmed(facts(), box.deps);
    const withAnotherDog = facts({
      pets: [
        ...facts().pets,
        {
          appointmentId: "appt-2",
          petId: "pet-2",
          petName: "Milo",
          serviceName: "Bath",
          status: "confirmed",
        },
      ],
    });
    const again = await notifyMerchantVisitConfirmed(withAnotherDog, box.deps);
    assert.deepEqual(again, { email: "duplicate", sms: "duplicate" });
    assert.equal(box.emailCalls.length, 1);
  });

  it("lets only one of two overlapping sends reach the provider", async () => {
    const box = harness();
    const [first, second] = await Promise.all([
      notifyMerchantVisitConfirmed(facts(), box.deps),
      notifyMerchantVisitConfirmed(facts(), box.deps),
    ]);
    const outcomes = [first.email, second.email].sort();
    assert.deepEqual(outcomes, ["accepted", "uncertain"]);
    assert.equal(box.emailCalls.length, 1);
    assert.equal(box.smsCalls.length, 1);
  });

  it("reclaims a definite provider failure once and leaves an accepted row unsent", async () => {
    const box = harness();
    box.setEmailResult({ outcome: "failed", error: "Resend 422" });
    const failed = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(failed.email, "failed");
    assert.equal(failed.sms, "accepted");
    const emailRow = box.store.rows().find((row) => row.snapshot.channel === "email");
    assert.equal(emailRow?.status, "failed");
    assert.equal(emailRow?.providerMessageId, null);
    box.setEmailResult({ outcome: "accepted", providerMessageId: "email-2" });
    const retried = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(retried.email, "accepted");
    assert.equal(retried.sms, "duplicate");
    assert.equal(box.emailCalls.length, 2);
    assert.equal(box.smsCalls.length, 1);
    const settled = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(settled.email, "duplicate");
    assert.equal(box.emailCalls.length, 2);
    assert.equal(
      box.store.rows().find((row) => row.snapshot.channel === "email")?.status,
      "accepted",
    );
  });

  it("does not resend when the provider outcome is uncertain", async () => {
    const box = harness();
    box.setSmsResult({ outcome: "uncertain", error: "Twilio 503" });
    const first = await notifyMerchantVisitConfirmed(facts(), box.deps);
    const second = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(first.sms, "uncertain");
    assert.equal(second.sms, "uncertain");
    assert.equal(box.smsCalls.length, 1);
    assert.equal(first.email, "accepted");
  });

  it("skips SMS when the merchant phone is missing and still sends email", async () => {
    const box = harness(merchantEnv({ MERCHANT_NOTIFY_PHONE: "" }));
    const summary = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(summary.email, "accepted");
    assert.equal(summary.sms, "skipped");
    assert.equal(box.smsCalls.length, 0);
    assert.equal(box.emailCalls.length, 1);
    const smsRow = box.store.rows().find((row) => row.snapshot.channel === "sms");
    assert.equal(smsRow?.status, "skipped");
    assert.equal(smsRow?.snapshot.skipReason, "missing_config");
    assert.equal(smsRow?.providerCalledAt, null);
  });

  it("retries one failed claim in the same request", async () => {
    const box = harness(merchantEnv(), {
      claimFailures: 1,
      alertFailures: 0,
      completeFailures: 0,
    });
    const summary = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(summary.email, "accepted");
    assert.equal(summary.sms, "accepted");
    assert.equal(box.emailCalls.length, 1);
    assert.equal(box.smsCalls.length, 1);
  });

  it("defers both channels when the log cannot be claimed, then replays once", async () => {
    const box = harness(merchantEnv(), {
      claimFailures: 4,
      alertFailures: 0,
      completeFailures: 0,
    });
    const summary = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.deepEqual(summary, { email: "deferred", sms: "deferred" });
    assert.equal(box.emailCalls.length, 0);
    assert.equal(box.smsCalls.length, 0);
    assert.equal(box.store.alerts().length, 2);
    for (const alert of box.store.alerts()) {
      assert.equal(alert.message.includes("penny@"), false);
      assert.equal(alert.message.includes("+1555"), false);
      assert.match(alert.message, /^v=visit-1 t=merchant_visit_confirmed c=(email|sms) fp=-$/);
    }
    box.faults.claimFailures = 0;
    const replay = await replayDeferredMerchantAlerts({
      ...box.deps,
      loadVisit: async () => facts(),
    });
    assert.deepEqual(replay, { replayed: 2, kept: 0 });
    assert.equal(box.emailCalls.length, 1);
    assert.equal(box.smsCalls.length, 1);
    assert.equal(box.store.alerts().length, 0);
  });

  it("does not send when both the claim and the alert write fail", async () => {
    const box = harness(merchantEnv(), {
      claimFailures: 4,
      alertFailures: 2,
      completeFailures: 0,
    });
    const summary = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.deepEqual(summary, { email: "unrecorded", sms: "unrecorded" });
    assert.equal(box.emailCalls.length, 0);
    assert.equal(box.smsCalls.length, 0);
    assert.equal(box.store.rows().length, 0);
    assert.equal(box.store.alerts().length, 0);
  });

  it("does not send again when the accepted outcome cannot be saved", async () => {
    const box = harness(merchantEnv(), {
      claimFailures: 0,
      alertFailures: 0,
      completeFailures: 1,
    });
    const first = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(first.email, "uncertain");
    assert.equal(first.sms, "accepted");
    const second = await notifyMerchantVisitConfirmed(facts(), box.deps);
    assert.equal(second.email, "uncertain");
    assert.equal(second.sms, "duplicate");
    assert.equal(box.emailCalls.length, 1);
    assert.equal(box.smsCalls.length, 1);
    assert.equal(
      box.store.alerts().some((alert) => alert.code === "outcome_unresolved"),
      true,
    );
  });

  it("uses completed copy for a finished reschedule and request copy for a request", async () => {
    const completed = buildMerchantRescheduleCopy("completed", {
      ...facts(),
      previousWhenLabel: "Tuesday, November 3, 2026, 9:00 AM",
    });
    const requested = buildMerchantRescheduleCopy("requested", {
      ...facts(),
      previousWhenLabel: "Tuesday, November 3, 2026, 9:00 AM",
    });
    assert.equal(completed.subject, "Visit rescheduled");
    assert.match(completed.emailText, /already on the calendar/);
    assert.doesNotMatch(completed.emailText, /has not changed/);
    assert.doesNotMatch(completed.emailText, /Reschedule requested/);
    assert.match(completed.sms, /Visit rescheduled/);
    assert.doesNotMatch(completed.sms, /not completed/);
    assert.equal(requested.subject, "Reschedule requested");
    assert.match(requested.emailText, /has not changed/);
    assert.doesNotMatch(requested.emailText, /already on the calendar/);
    assert.match(requested.sms, /not completed/);
    assert.match(requested.sms, /unchanged/);
    assert.doesNotMatch(requested.sms, /Visit rescheduled/);

    const box = harness();
    const fingerprint = rescheduleFingerprint(
      "Tuesday, November 3, 2026, 9:00 AM",
      facts().whenLabel,
    );
    const sent = await notifyMerchantReschedule(
      "completed",
      { ...facts(), previousWhenLabel: "Tuesday, November 3, 2026, 9:00 AM", fingerprint },
      box.deps,
    );
    assert.equal(sent.email, "accepted");
    const later = rescheduleFingerprint(
      facts().whenLabel,
      "Thursday, November 5, 2026, 11:00 AM",
    );
    const next = await notifyMerchantReschedule(
      "completed",
      {
        ...facts({ whenLabel: "Thursday, November 5, 2026, 11:00 AM" }),
        previousWhenLabel: facts().whenLabel,
        fingerprint: later,
      },
      box.deps,
    );
    assert.equal(next.email, "accepted");
    assert.equal(box.emailCalls.length, 2);
    const same = await notifyMerchantReschedule(
      "completed",
      {
        ...facts({ whenLabel: "Thursday, November 5, 2026, 11:00 AM" }),
        previousWhenLabel: facts().whenLabel,
        fingerprint: later,
      },
      box.deps,
    );
    assert.equal(same.email, "duplicate");
    assert.equal(box.emailCalls.length, 2);
  });
});

describe("customer confirmation stays on its own path", () => {
  it("keeps the customer confirmation subject", () => {
    const email = buildBookingConfirmationEmail({
      customerName: "Ada",
      petName: "Bella",
      serviceName: "Full Haircut",
      dateLabel: "Wednesday, November 4, 2026",
      timeLabel: "2:00 PM",
    });
    assert.equal(email.subject, "Your Appointment Is Confirmed");
  });

  it("sends the customer mail from the booking helper and the merchant mail beside it", () => {
    const created = functionBody(
      "src/lib/email/appointment-mails.ts",
      "sendAppointmentCreatedEmails",
    );
    assert.match(created, /notifyCustomerAppointmentSubmitted/);
    assert.doesNotMatch(created, /notifyStaffNewAppointment/);
    const customer = functionBody(
      "src/lib/email/appointment-mails.ts",
      "notifyCustomerAppointmentConfirmed",
    );
    assert.match(customer, /sendEmail/);
    assert.match(customer, /sendAppointmentConfirmedSms/);
    const booking = functionBody("src/lib/appointments/service.ts", "createAppointment");
    assert.match(booking, /sendAppointmentCreatedEmails/);
    assert.match(booking, /notifyMerchantVisitConfirmedFromAppointments/);
    assert.match(booking, /payment_method_id: input.paymentMethodId/);
    const status = functionBody("src/lib/appointments/service.ts", "setAppointmentStatus");
    assert.doesNotMatch(status, /notifyMerchant/);
  });

  it("notifies the merchant only after a staff-created booking is confirmed", () => {
    const created = source("src/lib/staff/create-customer-booking.ts");
    assert.match(created, /pending_confirmation/);
    assert.doesNotMatch(created, /notifyMerchant/);
    const confirmed = functionBody(
      "src/lib/staff/confirm-customer-booking.ts",
      "confirmStaffCreatedBooking",
    );
    assert.match(confirmed, /notifyCustomerAppointmentConfirmed\(appointment/);
    assert.match(confirmed, /notifyMerchantVisitConfirmedFromAppointments\(appointments/);
    assert.match(source("src/lib/staff/confirm-customer-booking.ts"), /visit_id/);
  });

  it("notifies the merchant of a customer cancel and a completed reschedule", () => {
    const change = source("src/lib/appointments/customer-change.ts");
    assert.match(change, /notifyMerchantVisitCancelled/);
    assert.match(change, /notifyMerchantRescheduleCompletedFromAppointments/);
    assert.doesNotMatch(change, /notifyMerchantReschedule\(/);
    assert.doesNotMatch(change, /notifyStaffNewAppointment/);
    assert.match(change, /notifyCustomerAppointmentChange\("add_dog"/);
    assert.doesNotMatch(source("src/lib/appointments/staff-reschedule.ts"), /notifyMerchant/);
  });

  it("does not treat a customer reply C as a new visit notice", () => {
    const inbound = source("src/lib/sms/inbound.ts");
    assert.doesNotMatch(inbound, /notifyMerchantVisitConfirmed/);
    assert.match(inbound, /Customer confirmed —/);
    const confirmedCopy = buildMerchantVisitConfirmedCopy(facts());
    assert.equal(confirmedCopy.subject, "New visit confirmed");
    assert.doesNotMatch(confirmedCopy.subject, /Customer confirmed/);
  });
});
