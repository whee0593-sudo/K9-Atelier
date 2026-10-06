import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import { buildChargeReceiptCardHtml } from "./receipt-email";
import {
  buildAfterVisitThankYouSms,
  shouldSendAfterVisitThankYou,
} from "./receipts";

const appointment = {
  petName: "Daisy",
  appointmentDate: "2026-08-22",
  appointmentTime: "10:00",
  timezone: "America/New_York",
} as AdminAppointmentRecord;

const charge = {
  kind: "service",
  lineItems: [{ id: "1", label: "Signature Bath & Style", amount: 140 }],
  tipAmount: 0,
  total: 140,
  refundedAmount: 0,
  paidAt: "2026-08-22T18:00:00.000Z",
} as AppointmentChargeRecord;

describe("payment and receipt review requests", () => {
  it("does not ask for a review in the payment thank-you SMS", () => {
    const sms = buildAfterVisitThankYouSms(appointment);
    assert.equal(/review/i.test(sms), false);
    assert.equal(/google/i.test(sms), false);
    assert.equal(sms.includes("g.page"), false);
    assert.match(sms, /Thank you for entrusting Daisy/);
    assert.match(sms, /k9atelier\.com\/book/);
  });

  it("does not send the after-visit note for a no-show payment", () => {
    assert.equal(shouldSendAfterVisitThankYou("no_show"), false);
    assert.equal(shouldSendAfterVisitThankYou("service"), true);
  });

  it("does not include a review CTA in the receipt email", () => {
    const html = buildChargeReceiptCardHtml(appointment, charge);
    assert.equal(html.includes("Leave A Review"), false);
    assert.equal(html.includes("g.page"), false);
    assert.equal(/google review/i.test(html), false);
    assert.match(html, /Book Again/);
  });
});