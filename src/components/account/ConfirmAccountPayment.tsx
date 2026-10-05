"use client";

import React, { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import {
  AddCardForm,
  stripePromiseFor,
} from "@/components/account/PaymentMethodsManager";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";
import {
  createConfirmPaymentSetupIntent,
  saveConfirmPaymentSetupIntent,
} from "@/lib/payments/client";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";
import { SECURE_APPOINTMENT_CARD_MESSAGE } from "@/lib/staff/customer-confirm-status";

const PREVIEW_CARD: PaymentMethodRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  brand: "visa",
  last4: "4242",
  expMonth: 12,
  expYear: 2028,
  isDefault: true,
};

export function ConfirmAccountPayment({
  token,
  preview = false,
  methods,
  stripeConfigured = true,
  onChange,
}: {
  token: string;
  preview?: boolean;
  methods: PaymentMethodRecord[];
  stripeConfigured?: boolean;
  onChange: (methods: PaymentMethodRecord[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardSetup, setCardSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);

  async function startAddCard() {
    setError(null);
    if (preview) {
      onChange([PREVIEW_CARD]);
      return;
    }
    if (!stripeConfigured) {
      setError("Card setup is not available yet. Please contact penny@k9atelier.com");
      return;
    }
    setAdding(true);
    try {
      const setup = await createConfirmPaymentSetupIntent(token);
      setCardSetup(setup);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "This card could not be started. Please try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="border border-gray-line/80 bg-ivory p-6">
      <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Payment method
      </p>
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
        {SECURE_APPOINTMENT_CARD_MESSAGE}
      </p>
      {methods.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {methods.map((method) => (
            <li key={method.id} className="font-body text-sm text-ink">
              {formatPaymentMethodLabel(method)}
              {method.isDefault ? " · Default" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {cardSetup ? (
        <div className="mt-4">
          <Elements
            stripe={stripePromiseFor(cardSetup.publishableKey)}
            options={{
              clientSecret: cardSetup.clientSecret,
              locale: "en",
              appearance: { theme: "stripe" },
            }}
          >
            <AddCardForm
              clientSecret={cardSetup.clientSecret}
              returnUrl={
                typeof window === "undefined" ? undefined : window.location.href
              }
              saveSetupIntent={(setupIntentId) =>
                saveConfirmPaymentSetupIntent(token, setupIntentId)
              }
              onSaved={(method) => {
                const next = methods.some((item) => item.id === method.id)
                  ? methods
                  : [...methods, method];
                onChange(next);
                setCardSetup(null);
              }}
              onCancel={() => setCardSetup(null)}
            />
          </Elements>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startAddCard()}
          disabled={adding}
          className={`${bookingSecondaryBtnClass} mt-4`}
        >
          {adding ? "Preparing…" : methods.length > 0 ? "Use a different card" : "Add a card"}
        </button>
      )}
      {error ? (
        <p className="font-body mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
