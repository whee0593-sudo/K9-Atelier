import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReceiptServiceTime } from "./receipt-view";
import { buildChargeReceiptEmail } from "./receipts";
import { buildChargeReceiptCardHtml, buildChargeReceiptCardText } from "./receipt-email";
import { buildPreviewCollectContext } from "./preview";
import type { AppointmentChargeRecord } from "./types";

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
      });
    }
  }

  it("uses a readable fallback when no pet name is available", () => {
    assert.equal(buildChargeReceiptEmail({ ...appointment, petName: " " }, baseCharge).subject, "Receipt for your pet");
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
