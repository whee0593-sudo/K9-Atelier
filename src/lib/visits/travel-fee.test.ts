import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveTravelFee, parseTravelFeeOverride, withTravelFee, visitTravelLinesMatch } from "./travel-fee";
import { buildVisitBill, chargedVisitSnapshot } from "@/lib/charges/visit-bill";
import { validateStaffCustomerBookingInput } from "@/lib/staff/create-customer-booking-input";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { buildChargeReceiptParagraphs } from "@/lib/charges/receipt-content";
import type { AppointmentChargeRecord } from "@/lib/charges/types";

describe("visit travel override", () => {
  it("defaults to automatic and preserves an explicit zero", () => {
    assert.equal(parseTravelFeeOverride(undefined), null);
    assert.equal(effectiveTravelFee(33, null), 33);
    assert.equal(effectiveTravelFee(33, parseTravelFeeOverride(0)), 0);
    assert.equal(effectiveTravelFee(33, parseTravelFeeOverride(12.25)), 12.25);
    const body = { email: "guest@example.com", travelFeeOverride: 0 };
    assert.equal(validateStaffCustomerBookingInput(body).travelFeeOverride, 0);
    assert.equal(validateStaffCustomerBookingInput({ email: body.email }).travelFeeOverride, null);
  });
  it("rejects invalid amounts without converting empty input to a waiver", () => {
    for (const value of [-1, 5000.01, NaN, Infinity, "", "0", true, {}, 1.234]) {
      assert.throws(() => parseTravelFeeOverride(value));
      assert.throws(() => validateStaffCustomerBookingInput({ email: "guest@example.com", travelFeeOverride: value }));
    }
  });
  it("prevents dog edits and stale checkout from duplicating or changing travel", () => {
    const items = [{ id: "s", label: "Bath", amount: 80 },
      { id: "t", label: "Travel", catalogId: "travel-fee", amount: 33 }];
    assert.deepEqual(withTravelFee(items, 0), [items[0]]);
    const normalized = withTravelFee([...items, items[1]!], 12.25);
    assert.equal(normalized.filter((item) => item.catalogId === "travel-fee").length, 1);
    assert.equal(visitTravelLinesMatch(normalized, 12.25), true);
    assert.equal(visitTravelLinesMatch(normalized, 0), false);
    assert.equal(visitTravelLinesMatch([...items, items[1]!], 66), false);
  });
  it("charges travel once for two dogs and keeps the receipt snapshot consistent", () => {
    for (const fee of [0, 12.25, 33]) {
      const bill = buildVisitBill({ visitId: "v", customerName: "Guest", serviceDate: "2026-11-01", arrivalLabel: "9 AM", travelFee: fee,
        pets: ["Daisy", "Milo"].map((petName) => ({ appointmentId: petName, petName, serviceName: "Bath", servicePrice: 80, status: "confirmed", serviceEndedAt: "2026-11-01T12:00:00Z" })) });
      assert.equal(bill.subtotal, 160 + fee);
      assert.equal(bill.lineItems.filter((item) => item.catalogId === "travel-fee").length, fee ? 1 : 0);
      const receipt = chargedVisitSnapshot({ bill, lineItems: bill.lineItems, total: bill.subtotal });
      assert.equal(receipt.travelFee, fee);
      assert.equal(receipt.total, 160 + fee);
      const charge: AppointmentChargeRecord = {
        id: "charge", appointmentId: "Daisy", kind: "service", status: "paid",
        lineItems: bill.lineItems, subtotal: bill.subtotal, tipAmount: 0, total: bill.subtotal,
        receiptChannel: "email", paidAt: "2026-11-01T12:00:00Z", refundedAmount: 0, billSnapshot: receipt,
      };
      const paragraphs = buildChargeReceiptParagraphs(buildPreviewCollectContext().appointment, charge);
      const travel = paragraphs.filter((line) => line.startsWith("Travel fee"));
      assert.equal(travel.length, fee ? 1 : 0);
      if (fee) assert.match(travel[0]!, new RegExp(fee.toFixed(2).replace(".", "\\.")));
      assert.match(paragraphs.join("\n"), new RegExp(`Total paid.*${(160 + fee).toFixed(2).replace(".", "\\.")}`));
    }
  });
});
