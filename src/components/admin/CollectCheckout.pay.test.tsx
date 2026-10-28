import React, { type ComponentProps } from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PayStep } from "./CollectCheckout";
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
