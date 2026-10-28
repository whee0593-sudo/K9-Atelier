import React, { type ComponentProps } from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerBillItems, PayStep } from "./CollectCheckout";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { quoteReferralApplication } from "@/lib/referrals/eligible";

Object.assign(globalThis, { React });

it("presents only final grooming prices and includes assessed DeMatting in the bill", () => {
  const input = props("service");
  const html = renderToStaticMarkup(<PayStep {...input} lineItems={[
    { id: "v", label: "Valentino Full Groom", amount: 200, listAmount: 180 },
    { id: "s", label: "Stella Full Groom", amount: 200, listAmount: 180 },
    { id: "d", label: "Gentle DeMatting", amount: 25, catalogId: "dematting-brush-out" },
  ]} subtotal={425} total={425} />);
  assert.doesNotMatch(html, /\$180\.00|line-through/);
  assert.equal((html.match(/\$200\.00/g) ?? []).length, 2);
  assert.match(html, /Gentle DeMatting/);
  assert.match(html, /\$25\.00/);
  assert.match(html, /\$425\.00/);
});

function props(kind: "service" | "no_show"): ComponentProps<typeof PayStep> {
  const context = buildPreviewCollectContext();
  const noop = () => {};
  return {
    kind, context, lineItems: context.lineItems, subtotal: 140,
    tipMode: null, customTip: "", tipAmount: 0, total: 140,
    referralQuote: quoteReferralApplication({lineItems: context.lineItems, tipAmount: 0,
      availableCreditCents: 1000, mode: "none", applyNewClientDiscount: false}),
    referralMode: "none", referralCustom: "", referralCode: "", referralCodeStatus: "idle",
    referralCodeMessage: null, methods: context.methods, selectedMethodId: "preview-card",
    useNewCard: false, useCash: false, useZelle: false, busy: false,
    clientSecret: null, chargeId: null,
    onTipMode: noop, onCustomTip: noop, onReferralMode: noop, onReferralCustom: noop,
    onReferralCodeChange: noop, onApplyReferralCode: noop, onSelectMethod: noop,
    onUseNewCard: noop, onUseCash: noop, onUseZelle: noop, onBack: noop,
    onPay: async () => {}, onPaid: noop, onError: noop, onBusy: noop,
  };
}

it("preserves the current service checkout, referral controls and payment selector", () => {
  const html = renderToStaticMarkup(<PayStep {...props("service")} />);
  assert.match(html, /Gratuity/);
  assert.match(html, /Discounts &amp; referral credit/);
  assert.match(html, /Change payment method/);
  assert.match(html, /Use a different card/);
});

it("keeps no-show fees fixed and the unknown payment blocked after the merge", () => {
  const html = renderToStaticMarkup(<PayStep {...props("no_show")}
    paymentNotice="This payment needs a manual check." paymentBlocked onCheckPayment={() => {}} />);
  assert.match(html, /confirmed no-show fee/);
  assert.doesNotMatch(html, /Gratuity|Discounts &amp; referral credit|Use a different card/);
  assert.match(html, /Check payment status/);
  assert.match(html, /manual check/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Pay \$140/);
});


it("presents the two-dog bill in the requested order with the final total", () => {
  const input = props("service");
  const lineItems = [
    {id:"s1", appointmentId:"stella", petName:"Stella", label:"Stella — The Atelier Full Groom", amount:200, listAmount:180},
    {id:"v1", appointmentId:"valentino", petName:"Valentino", label:"Valentino — The Atelier Full Groom", amount:200, listAmount:180},
    {id:"s2", appointmentId:"stella", petName:"Stella", label:"Stella — Gentle DeMatting", amount:25},
    {id:"v2", appointmentId:"valentino", petName:"Valentino", label:"Valentino — Gentle care", amount:40},
  ];
  const context = {...input.context, visit: {id:"visit", customerName:"Taylor Owner", serviceDate:"2026-10-28", arrivalLabel:"10:00 AM", servicedDogCount:2, blockedMessage:null, paymentStatus:"unpaid" as const}};
  const html = renderToStaticMarkup(<PayStep {...input} context={context} lineItems={lineItems} subtotal={465} total={465} />);
  const text = html.replace(/<[^>]*>/g, " ");
  assert.match(text, /Taylor Owner/); assert.match(text, /Oct 28 · 10:00 AM/);
  assert.match(text, /Stella.*The Atelier Full Groom.*\$200\.00.*Gentle DeMatting.*\$25\.00.*Valentino.*The Atelier Full Groom.*\$200\.00.*Gentle care.*\$40\.00/);
  assert.doesNotMatch(html, /\$180\.00|line-through|Subtotal|2 dogs/);
  assert.match(text, /Gratuity.*\$0\.00/);
  assert.match(text, /15%.*18%.*20%.*Custom.*Discounts &amp; referral credit.*Payment.*Change payment method.*Total to pay.*\$465\.00.*Pay \$465\.00.*Back to review/);
});

it("keeps same-name dogs separate and visit charges unassigned", () => {
  const html = renderToStaticMarkup(<CustomerBillItems lineItems={[
    {id:"a", appointmentId:"a", petName:"Bella", label:"Bella — Full Groom", amount:100},
    {id:"b", appointmentId:"b", petName:"Bella", label:"Bella — Bath", amount:80},
    {id:"t", label:"Travel fee", amount:15, catalogId:"travel-fee"},
    {id:"c", label:"Additional care", amount:10},
  ]} />);
  assert.equal((html.match(/aria-label="Bella"/g) ?? []).length, 2);
  assert.match(html, /Travel fee/); assert.match(html, /Additional care/);
  assert.equal((html.match(/aria-label="Visit charges"/g) ?? []).length, 2);
});
