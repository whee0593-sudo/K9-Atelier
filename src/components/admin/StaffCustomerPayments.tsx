"use client";

import { Elements } from "@stripe/react-stripe-js";
import React, { useMemo, useState } from "react";
import {
  AddCardForm,
  stripePromiseFor,
} from "@/components/account/PaymentMethodsManager";
import {
  createStaffPaymentSetupIntent,
  deleteStaffCustomerPaymentMethod,
  saveStaffPaymentSetupIntent,
} from "@/lib/payments/client";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";

export function StaffCustomerPayments({
  customerId,
  methods,
  preview = false,
  onChange,
}: {
  customerId: string;
  methods: PaymentMethodRecord[];
  preview?: boolean;
  onChange: (methods: PaymentMethodRecord[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [adding, setAdding] = useState(false);

  const visibleMethods = methods.filter(
    (method, index) => methods.findIndex((item) => item.id === method.id) === index,
  );
  const stripePromise = useMemo(
    () => (setup ? stripePromiseFor(setup.publishableKey) : null),
    [setup],
  );

  async function startAddCard() {
    setAdding(true);
    setError(null);
    try {
      if (preview) {
        const next: PaymentMethodRecord = {
          id: crypto.randomUUID(),
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2028,
          isDefault: methods.length === 0,
        };
        onChange(
          methods.some((method) => method.id === next.id)
            ? methods
            : [...methods, next],
        );
        setAdding(false);
        return;
      }
      const next = await createStaffPaymentSetupIntent(customerId);
      setSetup(next);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Card setup is not available yet.",
      );
      setAdding(false);
    }
  }

  async function removeCard(id: string) {
    if (!window.confirm("Remove this card from the customer account?")) return;
    setError(null);
    try {
      if (!preview) {
        await deleteStaffCustomerPaymentMethod(customerId, id);
      }
      const remaining = methods.filter((method) => method.id !== id);
      if (remaining.length > 0 && !remaining.some((method) => method.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      onChange(remaining);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove this card.",
      );
    }
  }

  return (
    <section>
      <h3 className="text-base font-medium text-gold-dark">Payment Methods</h3>
      {error ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {visibleMethods.length === 0 && !setup ? (
        <p className="mt-3 text-sm text-text-muted">No cards on file.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visibleMethods.map((method) => (
            <li
              key={method.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-lavender/40 bg-cream px-4 py-3 text-sm"
            >
              <div>
                <p className="text-text">{formatPaymentMethodLabel(method)}</p>
                {method.isDefault ? (
                  <p className="mt-1 text-xs text-text-muted">Default</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void removeCard(method.id)}
                className="text-xs text-text-muted underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {setup && stripePromise ? (
        <div className="mt-4 rounded-xl border border-lavender/40 bg-cream p-4">
          <p className="mb-4 text-sm font-medium text-gold-dark">Add a card</p>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: setup.clientSecret,
              locale: "en",
              appearance: { theme: "stripe" },
            }}
          >
            <AddCardForm
              clientSecret={setup.clientSecret}
              returnUrl={`${typeof window === "undefined" ? "" : window.location.origin}/admin/pets`}
              saveSetupIntent={(setupIntentId) =>
                saveStaffPaymentSetupIntent(customerId, setupIntentId)
              }
              onSaved={(method) => {
                const exists = methods.some((item) => item.id === method.id);
                onChange(
                  exists
                    ? methods.map((item) => (item.id === method.id ? method : item))
                    : [...methods, method],
                );
                setSetup(null);
                setAdding(false);
              }}
              onCancel={() => {
                setSetup(null);
                setAdding(false);
              }}
            />
          </Elements>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startAddCard()}
          disabled={adding}
          className="mt-4 rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm font-medium text-gold-dark disabled:opacity-60"
        >
          {adding ? "Preparing…" : "+ Add a card"}
        </button>
      )}
    </section>
  );
}
