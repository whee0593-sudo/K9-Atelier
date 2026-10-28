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

it("shows a save action only for edited care and disables edits while saving", async () => {
  const { VisitServiceEditor } = await import("@/components/admin/VisitServiceEditor");
  const props = {lineItems: [{id:"groom", label:"The Atelier Full Groom", amount:200}], catalogGroups:[], onChange() {}, onSave() {}};
  const clean = renderToStaticMarkup(<VisitServiceEditor {...props} />);
  assert.doesNotMatch(clean, />Save<\/button>/);
  const edited = renderToStaticMarkup(<VisitServiceEditor {...props} dirty />);
  assert.match(edited, />Save<\/button>/);
  assert.match(edited, /\$200\.00/);
  const saving = renderToStaticMarkup(<VisitServiceEditor {...props} dirty saving />);
  assert.match(saving, /disabled=""[^>]*>Saving…<\/button>/);
  assert.match(saving, /type="number"[^>]*disabled=""/);
  const saved = renderToStaticMarkup(<VisitServiceEditor {...props} notice="Services saved." />);
  assert.doesNotMatch(saved, />Save<\/button>/);
  assert.match(saved, /Services saved/);
});


it("keeps the paid screen, HTML email and text email consistent for the two-dog receipt", () => {
  const paid = {...charge, id:"receipt-465", paidAt:"2026-10-28T18:00:00Z", subtotal:465, total:465, tipAmount:0,
    lineItems:[
      {id:"s1",appointmentId:"s",petName:"Stella",label:"Stella — The Atelier Full Groom",amount:200,listAmount:180},
      {id:"v1",appointmentId:"v",petName:"Valentino",label:"Valentino — The Atelier Full Groom",amount:200,listAmount:180},
      {id:"s2",appointmentId:"s",petName:"Stella",label:"Stella — Gentle DeMatting",amount:25},
      {id:"v2",appointmentId:"v",petName:"Valentino",label:"Valentino — Gentle Care",amount:40},
    ],
    billSnapshot:{...charge.billSnapshot!,serviceDate:"2026-10-28",arrivalLabel:"10:00 AM",subtotal:465,total:465,
      paymentMethodLabel:"Visa ending in 4242",pets:[{appointmentId:"s",petName:"Stella",serviceName:"The Atelier Full Groom",amount:200},{appointmentId:"v",petName:"Valentino",serviceName:"The Atelier Full Groom",amount:200}]},
  } as AppointmentChargeRecord;
  for (const output of [renderToStaticMarkup(<ChargeReceiptLetter appointment={appointment} charge={paid} />), buildChargeReceiptCardHtml(appointment,paid,"Visa ending in 4242"),buildChargeReceiptCardText(appointment,paid)]) {
    const text=output.replace(/<[^>]*>/g," ").replace(/\s+/g," ");
    assert.match(text,/Stella and Valentino/);
    assert.match(text,/Wednesday, October 28, 2026/);
    assert.match(text,/Stella.*The Atelier Full Groom.*\$200\.00.*Gentle DeMatting.*\$25\.00.*Valentino.*The Atelier Full Groom.*\$200\.00.*Gentle Care.*\$40\.00/);
    assert.match(text,/Subtotal.*\$465\.00.*TOTAL PAID.*\$465\.00/);
    assert.match(text,/Payment status: Paid/);assert.match(text,/Payment date: October 28, 2026/);assert.match(text,/Visa ending in 4242/);
    assert.match(text,/File a Concern/);assert.doesNotMatch(output,/\$180\.00|line-through/);
  }
});

it("saves a validated receipt recipient separately from an unfinished email edit", async () => {
  const {initialReceiptEmailState,receiptEmailReducer,receiptEmailAddress}=await import("./receipt-recipient");
  let state=initialReceiptEmailState("owner@example.com");
  state=receiptEmailReducer(state,{type:"edit"});
  state=receiptEmailReducer(state,{type:"change",value:" New.Address@Example.com "});
  assert.equal(state.email,"owner@example.com");assert.equal(state.editing,true);
  state=receiptEmailReducer(state,{type:"save"});
  assert.equal(state.email,"new.address@example.com");assert.equal(state.editing,false);
  state=receiptEmailReducer(state,{type:"edit"});state=receiptEmailReducer(state,{type:"change",value:"invalid"});
  state=receiptEmailReducer(state,{type:"save"});
  assert.equal(state.email,"new.address@example.com");assert.equal(state.editing,true);assert.ok(state.error);
  for(const invalid of [null,12,"", "person@example.com\r\nBcc: other@example.com", "a".repeat(255)+"@example.com"]) assert.equal(receiptEmailAddress(invalid),null);
});

it("lets the receipt choose a different email and scopes sent status to its recipient", async () => {
  const {ChargeReceiptActions}=await import("@/components/admin/ChargeReceiptActions");
  const unsent=renderToStaticMarkup(<ChargeReceiptActions customerEmail="owner@example.com" onSendEmail={()=>{}} />);
  assert.match(unsent,/Use a different email/);assert.match(unsent,/owner@example.com/);
  const sent=renderToStaticMarkup(<ChargeReceiptActions customerEmail="new@example.com" sentTo="new@example.com" onSendEmail={()=>{}} />);
  assert.match(sent,/Receipt sent/);assert.match(sent,/Sent to new@example.com/);
  const changed=renderToStaticMarkup(<ChargeReceiptActions customerEmail="new@example.com" sentTo="old@example.com" onSendEmail={()=>{}} />);
  assert.match(changed,/Send receipt by email/);assert.doesNotMatch(changed,/Receipt sent/);
});
