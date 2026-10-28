import React from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChargeReceiptLetter } from "@/components/admin/ChargeReceiptLetter";
import { buildChargeReceiptCardHtml, buildChargeReceiptCardText } from "./receipt-email";
import { receiptPetNames } from "./receipt-view";
import { sanitizeLineItems } from "./line-items";
import { catalogLinePatch } from "./list-amount";
import { buildPreviewCollectContext } from "./preview";
import type { AppointmentChargeRecord } from "./types";
Object.assign(globalThis, { React });
const appointment = buildPreviewCollectContext().appointment;
const lineItems = ["Valentino", "Stella"].map((petName, i) => ({
  id: String(i), label: "Full Groom", amount: 200, listAmount: 180, petName,
  catalogId: "custom-full-haircut",
}));
const charge = { kind: "service", status: "paid", lineItems, subtotal: 400,
  total: 400, tipAmount: 0, refundedAmount: 0,
  billSnapshot: { pets: lineItems.map(p => ({petName:p.petName, amount:200, serviceName:"Full Groom"})),
    serviceDate: "2026-10-28", arrivalLabel: "10:00 AM", travelFee:0, discount:0, subtotal:400 }
} as AppointmentChargeRecord;
it("all receipt formats thank both pets and show final prices while retaining audit amounts", () => {
  assert.equal(receiptPetNames(appointment, charge), "Valentino and Stella");
  for (const output of [buildChargeReceiptCardHtml(appointment, charge),
    buildChargeReceiptCardText(appointment, charge), renderToStaticMarkup(<ChargeReceiptLetter appointment={appointment} charge={charge} />)]) {
    assert.match(output, /Valentino and Stella/);
    assert.match(output, /\$200\.00/);
    assert.doesNotMatch(output, /\$180\.00|line-through|→/);
  }
  assert.equal(sanitizeLineItems(lineItems)?.[0].listAmount, 180);
});
it("legacy receipts use all available checkout pet metadata", () => {
  assert.equal(receiptPetNames({...appointment, petName:"Valentino"}, {...charge, billSnapshot:undefined}), "Valentino and Stella");
});
it("on-site DeMatting accepts zero and assessed prices, rejecting invalid input", () => {
  const patch = catalogLinePatch({id:"dematting-brush-out", name:"Gentle DeMatting", suggestedAmount:null});
  assert.equal(patch.amount, 0);
  for (const amount of [0, 25.50, 5000]) {
    const result = sanitizeLineItems([{id:"d", ...patch, amount}]);
    assert.equal(result?.[0].amount, amount);
    assert.equal(result?.[0].catalogId, "dematting-brush-out");
  }
  for (const amount of [-1, 5000.01, NaN, Infinity, null, "", "25", true]) {
    assert.equal(sanitizeLineItems([{id:"d", ...patch, amount}]), null);
  }
});
