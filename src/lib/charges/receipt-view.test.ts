import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReceiptServiceTime } from "./receipt-view";
import { buildAfterVisitThankYouSms, buildChargeReceiptEmail } from "./receipts";
import { buildChargeReceiptCardHtml, buildChargeReceiptCardText } from "./receipt-email";
import { buildPreviewCollectContext } from "./preview";
import type { AppointmentChargeRecord } from "./types";
import { sendAutomaticReceipt } from "./automatic-receipt";

describe("automatic paid receipt", () => {
  const appointment = buildPreviewCollectContext().appointment;
  const paid = () => ({ id: "paid-charge", appointmentId: appointment.id, status: "paid", receiptChannel: null }) as AppointmentChargeRecord;

  it("emails the customer automatically and records delivery once", async () => {
    const charge = paid();
    const calls: string[] = [];
    const deps = {
      loadAppointment: async () => ({ ...appointment, customerEmail: "customer@example.com" }),
      sendReceipt: async (record: typeof appointment, sentCharge: AppointmentChargeRecord) => {
        assert.equal(record.customerEmail, "customer@example.com");
        assert.equal(sentCharge.id, charge.id);
        calls.push("send");
        return true;
      },
      markSent: async (id: string) => { assert.equal(id, charge.id); calls.push("record"); },
    };
    assert.equal(await sendAutomaticReceipt(charge, deps), true);
    assert.equal(charge.receiptChannel, "email");
    assert.equal(await sendAutomaticReceipt(charge, deps), false);
    assert.deepEqual(calls, ["send", "record"]);
  });

  it("does not email unpaid charges or customers without an email", async () => {
    const deps = {
      loadAppointment: async () => ({ ...appointment, customerEmail: "" }),
      sendReceipt: async () => { assert.fail("must not send"); },
      markSent: async () => { assert.fail("must not mark sent"); },
    };
    assert.equal(await sendAutomaticReceipt({ ...paid(), status: "pending" }, deps), false);
    assert.equal(await sendAutomaticReceipt(paid(), deps), false);
  });

  for (const failure of ["provider", "lookup", "record"] as const) {
    it(`keeps payment paid when ${failure} fails`, async () => {
      const charge = paid();
      assert.equal(await sendAutomaticReceipt(charge, {
        loadAppointment: async () => { if (failure === "lookup") throw new Error("lookup unavailable"); return appointment; },
        sendReceipt: async () => failure !== "provider",
        markSent: async () => { if (failure === "record") throw new Error("record unavailable"); },
      }), false);
      assert.equal(charge.status, "paid");
      assert.equal(charge.receiptChannel, null);
    });
  }
});

describe("receipt email subject", () => {
  const appointment = buildPreviewCollectContext().appointment;
  const baseCharge: AppointmentChargeRecord = {
    id: "charge", appointmentId: appointment.id, kind: "service", status: "paid",
    lineItems: [], subtotal: 48, total: 48, tipAmount: 0,
    refundedAmount: 0, paidAt: null, receiptChannel: null,
  };

  for (const names of [["Daisy"], ["Daisy", "Milo"], ["LYCHEE", "BELLA", "yoyo"]]) {
    const expected = names.length === 1 ? "Daisy"
      : names.length === 2 ? "Daisy and Milo" : "LYCHEE, BELLA, and yoyo";
    for (const snapshot of [false, true]) {
      it(`formats ${names.length} dogs using ${snapshot ? "paid snapshot" : "legacy metadata"} without changing the body`, () => {
        const record = { ...appointment, petName: snapshot ? "Old name" : names[0]! };
        const charge: AppointmentChargeRecord = {
          ...baseCharge,
          lineItems: names.map((petName, index) => ({ id: String(index), label: "Groom", amount: 48, petName })),
          ...(snapshot ? {
            billSnapshot: {
              version: 1, visitId: "visit", customerName: "Customer",
              serviceDate: "2026-10-31", arrivalLabel: "10 AM",
              pets: names.map((petName, index) => ({ appointmentId: String(index), petName, serviceName: "Groom", amount: 48 })),
              travelFee: 0, subtotal: 48, discount: 0, tip: 0, total: 48,
            },
          } : {}),
        };
        const email = buildChargeReceiptEmail(record, charge, "Visa ending in 1234");
        assert.equal(email.subject, `Receipt for ${expected}`);
        assert.doesNotMatch(email.subject, /\$|48\.00/);
        assert.equal(email.text, buildChargeReceiptCardText(record, charge, "Visa ending in 1234"));
        assert.equal(email.html, buildChargeReceiptCardHtml(record, charge, "Visa ending in 1234"));
        assert.match(email.text, /\$48\.00/);
        const sms = buildAfterVisitThankYouSms(record, charge);
        assert.equal(sms, [
          [
          `We keep a record of all tools and products used, along with your service requests, at every appointment for ${expected}.`,
          "If you have any questions about the service or would prefer a different fragrance, please feel free to contact us anytime. We have a full range of show dog grooming products and can tailor the products and fragrance to your preferences.",
          `Thank you for trusting your ${names.length > 1 ? "pups" : "pup"} with K9 Atelier. We look forward to seeing you again!`,
          ].join(" "),
          "Reply STOP to opt out.",
        ].join("\n"));
      });
    }
  }

  it("uses a readable fallback when no pet name is available", () => {
    assert.equal(buildChargeReceiptEmail({ ...appointment, petName: " " }, baseCharge).subject, "Receipt for your pet");
    assert.match(buildAfterVisitThankYouSms({ ...appointment, petName: " " }), /appointment for your pet\./);
    assert.match(buildAfterVisitThankYouSms({ ...appointment, petName: " Daisy " }), /appointment for Daisy\./);
  });
});

describe("receipt service time", () => {
  it("uses check-in and check-out clock times", () => {
    assert.equal(
      formatReceiptServiceTime({
        appointmentTime: "09:00",
        timezone: "America/New_York",
        serviceStartedAt: "2026-07-08T13:12:00.000Z",
        serviceEndedAt: "2026-07-08T15:03:00.000Z",
      }),
      "9:12 AM–11:03 AM",
    );
  });

  it("falls back to the booked window when the visit was not timed", () => {
    assert.equal(
      formatReceiptServiceTime({
        appointmentTime: "10:00–12:00 PM",
        timezone: "America/New_York",
        serviceStartedAt: null,
        serviceEndedAt: null,
      }),
      "10:00 AM–12:00 PM",
    );
  });
});
