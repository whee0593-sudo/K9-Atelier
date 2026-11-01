"use client";

import React, { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { AddCardForm, stripePromiseFor } from "./PaymentMethodsManager";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";
import { usableConfirmationCards } from "@/lib/staff/customer-confirm-status";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export function ConfirmAccountPayment({ token, methods, preview, stripeConfigured, onChange, beforeSave, onSaved }: {
  token: string;
  preview?: boolean;
  methods: PaymentMethodRecord[];
  stripeConfigured?: boolean;
  onChange: (methods: PaymentMethodRecord[]) => void;
  beforeSave: () => boolean;
  onSaved: (method: PaymentMethodRecord) => void;
}) {
  const usableMethods = usableConfirmationCards(methods);
  const [setup, setSetup] = useState<{clientSecret: string; publishableKey: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function startCard() {
    if (preview) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/confirm-account/payment/setup-intent", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({token}),
      });
      const body = await response.json();
      if (!response.ok || !body.clientSecret || !body.publishableKey) throw new Error(body.error ?? "Card setup is unavailable. Please try again.");
      setSetup(body);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Card setup is unavailable. Please try again.");
    } finally { setLoading(false); }
  }
  return (
    <div className="border border-gray-line/80 bg-ivory p-6">
      <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">Payment method</p>
      {usableMethods.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {usableMethods.map(method => (
            <li key={method.id} className="font-body text-sm text-ink">
              {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : "Card"} •••• {method.last4}
              {method.isDefault ? " · Default" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 font-body text-sm text-taupe">
          {!setup ? <button type="button" onClick={() => void startCard()} disabled={loading || stripeConfigured === false} className={bookingSecondaryBtnClass}>{loading ? "Loading…" : "Reserve a card"}</button> : null}
          <span> for your visit.</span>
          {setup ? <Elements stripe={stripePromiseFor(setup.publishableKey)} options={{clientSecret: setup.clientSecret, locale: "en"}}>
            <AddCardForm clientSecret={setup.clientSecret}
              submitLabel="Save & confirm appointment" beforeSave={beforeSave}
              returnUrl={typeof window === "undefined" ? undefined : window.location.href}
              saveSetupIntent={async (setupIntentId) => {
                const response = await fetch("/api/confirm-account/payment", {
                  method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({token, setupIntentId}),
                });
                const body = await response.json();
                if (!response.ok || !body.method) throw new Error(body.error ?? "This card could not be saved.");
                return body.method as PaymentMethodRecord;
              }}
              onSaved={(method) => { onChange([...methods, method]); setSetup(null); onSaved(method); }}
              onCancel={() => setSetup(null)}
            />
          </Elements> : null}
        </div>
      )}
      {error ? <p role="alert" className="font-body mt-3 text-sm text-red-700">{error}</p> : null}
      {stripeConfigured === false && usableMethods.length === 0 ? <p role="alert" className="font-body mt-3 text-sm text-red-700">Online card setup is unavailable. Please contact K9 Atelier.</p> : null}
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">You will not be charged now.</p>
    </div>
  );
}
