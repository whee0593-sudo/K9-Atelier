import assert from "node:assert/strict";
import { it } from "node:test";
import { receiptItems } from "./receipt-items";
import { buildChargeReceiptCardHtml, buildChargeReceiptCardText } from "./receipt-email";
import { buildPreviewCollectContext } from "./preview";
import { allBookableServices } from "../services";
import { getServiceById, specialtyCareDisplayService } from "../service-page";
import { getServiceDisplayName } from "../service-display";
import type { AppointmentChargeRecord } from "./types";

const charge: AppointmentChargeRecord = {
  id: "charge", appointmentId: "appointment", kind: "service", status: "paid",
  lineItems: [
    { id: "base", label: "MILKSHAKE — The Atelier Groom", amount: 150, petName: "MILKSHAKE", catalogId: "visit-pet-service" },
    { id: "extra", label: "Gentle Care", amount: 25, listAmount: 30 },
    { id: "custom", label: "Custom care", amount: 10 },
    { id: "travel", label: "Travel fee", catalogId: "travel-fee", amount: 20 },
  ],
  subtotal: 205, total: 210, tipAmount: 10, refundedAmount: 0, paidAt: null, receiptChannel: null,
  billSnapshot: {
    version: 1, visitId: "visit", customerName: "Customer", serviceDate: "2026-10-22", arrivalLabel: "1 PM",
    pets: [{ appointmentId: "appointment", petName: "MILKSHAKE", serviceName: "The Atelier Groom", amount: 150 }],
    travelFee: 20, subtotal: 205, discount: 5, tip: 10, total: 210,
  },
};
it("renders every paid checkout item and preserves amounts without mutating the charge", () => {
  const before = JSON.stringify(charge);
  const rows = receiptItems(charge);
  assert.deepEqual(rows.map(r => r.label), ["The Atelier Groom", "Gentle Care", "Custom care", "Travel fee", "Discount", "Subtotal"]);
  assert.equal(rows[1].amount, 25);
  assert.equal(rows[1].listAmount, 30);
  const appointment = buildPreviewCollectContext().appointment;
  for (const output of [buildChargeReceiptCardHtml(appointment, charge), buildChargeReceiptCardText(appointment, charge)]) {
    assert.match(output, /Gentle Care/);
    assert.match(output, /\$25\.00/);
    assert.match(output, /Custom care/);
    assert.doesNotMatch(output, /MILKSHAKE —/);
    assert.equal((output.match(/Travel fee/g) ?? []).length, 1);
  }
  assert.equal(JSON.stringify(charge), before);
});
it("falls back to historical snapshot when line items are absent", () => {
  assert.deepEqual(receiptItems({ ...charge, lineItems: [] }).map(r => r.label), ["The Atelier Groom", "Travel fee", "Discount", "Subtotal"]);
  assert.equal(receiptItems({ ...charge, billSnapshot: null })[1].amount, 25);
});
it("uses public Services names for every current booking service with stable ids", () => {
  for (const service of allBookableServices()) {
    const publicService = specialtyCareDisplayService(getServiceById(service.id)!);
    assert.equal(getServiceDisplayName(service.id, "Old label"), publicService.name, service.id);
  }
  assert.equal(getServiceDisplayName("retired-custom-id", "Historical service"), "Historical service");
});
