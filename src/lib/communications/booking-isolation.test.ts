import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildCommunicationContext } from "@/lib/communications/context";
import { dispatchCommunication } from "@/lib/communications/dispatch";
import type { CommunicationLogStore } from "@/lib/communications/store";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function failingStore(): CommunicationLogStore {
  return {
    async claim() {
      throw new Error("database unavailable");
    },
    async markAccepted() {
      throw new Error("database unavailable");
    },
    async markFailed() {
      throw new Error("database unavailable");
    },
    async recordAlert() {
      throw new Error("database unavailable");
    },
    async read() {
      throw new Error("database unavailable");
    },
  };
}

describe("booking and payment isolation", () => {
  it("keeps a paid charge when the communication log database throws", async () => {
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    let providerCalls = 0;
    try {
      const charge = { id: "charge-1", status: "paid" as const };
      try {
        await dispatchCommunication({
          channel: "sms",
          provider: "twilio",
          recipient: "+15615550100",
          subject: null,
          bodyText: "Thank you",
          bodyHtml: null,
          configured: true,
          recipientValid: true,
          now: new Date("2026-10-09T15:00:00.000Z"),
          store: failingStore(),
          context: buildCommunicationContext({
            notificationType: "thank_you",
            recipient: "+15615550100",
            fingerprint: "charge-1",
          }),
          send: async () => {
            providerCalls += 1;
            return { ok: true, providerMessageId: "SM1" };
          },
        });
      } catch (error) {
        console.error("after-visit thank-you SMS failed:", error);
      }
      assert.equal(charge.status, "paid");
      assert.equal(providerCalls, 1);
      assert.match(errors.join("\n"), /COMMUNICATION_LOG_WRITE_FAILED/);
    } finally {
      console.error = original;
    }
  });

  it("does not throw out of dispatch when both the log write and the provider fail", async () => {
    const result = await dispatchCommunication({
      channel: "email",
      provider: "resend",
      recipient: "owner@example.com",
      subject: "Booking received",
      bodyText: "We received Bella.",
      bodyHtml: null,
      configured: true,
      recipientValid: true,
      store: failingStore(),
      context: buildCommunicationContext({
        notificationType: "appointment_submitted",
        recipient: "owner@example.com",
      }),
      send: async () => {
        throw new Error("resend down");
      },
    });
    assert.equal(result.status, "failed");
    assert.match(result.errorMessage ?? "", /resend down/);
    assert.match(result.logError ?? "", /database unavailable/);
  });

  it("wraps appointment notification sends so a log failure cannot roll back the booking", () => {
    const booking = source("src/lib/appointments/service.ts");
    assert.match(
      booking,
      /await sendAppointmentCreatedEmails[\s\S]*catch \(emailError\)[\s\S]*return \{ appointment \}/,
    );
    assert.match(
      booking,
      /await sendAppointmentStatusEmails[\s\S]*catch \(emailError\)/,
    );
    assert.match(
      booking,
      /await sendCheckoutReadySms\(appointmentId\)[\s\S]*catch \(smsError\)/,
    );

    const customerChange = source("src/lib/appointments/customer-change.ts");
    assert.match(customerChange, /catch \(emailError\)/);
    assert.equal(
      (customerChange.match(/await notifyCustomerAppointmentChange/g) ?? [])
        .length >= 1,
      true,
    );

    const reschedule = source("src/lib/appointments/staff-reschedule.ts");
    assert.match(
      reschedule,
      /await notifyCustomerAppointmentChange[\s\S]*catch \(emailError\)/,
    );

    const charges = source("src/lib/charges/service.ts");
    assert.match(
      charges,
      /await sendAfterVisitThankYouSms\(appointment, chargeId\)[\s\S]*catch \(smsError\)[\s\S]*return charge/,
    );
  });
});
