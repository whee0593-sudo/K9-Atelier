"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPaymentSetupIntent,
  deleteCustomerPaymentMethod,
  fetchCustomerPaymentMethods,
  savePaymentSetupIntent,
} from "@/lib/payments/client";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function stripePromiseFor(publishableKey: string) {
  const existing = stripePromiseCache.get(publishableKey);
  if (existing) return existing;
  const promise = loadStripe(publishableKey);
  stripePromiseCache.set(publishableKey, promise);
  return promise;
}

function AddCardForm({
  onSaved,
  onCancel,
}: {
  onSaved: (method: PaymentMethodRecord) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/account/payment`,
        },
      });
      if (confirmError) {
        setError(confirmError.message ?? "This card could not be verified.");
        return;
      }
      if (!setupIntent?.id) {
        setError("This card could not be verified. Please try again.");
        return;
      }
      const method = await savePaymentSetupIntent(setupIntent.id);
      onSaved(method);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "This card could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !stripe}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Verifying…" : "Save Card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PaymentMethodsManager() {
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCustomerPaymentMethods();
      setMethods(result.methods);
      setConfigured(result.configured);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load saved cards.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stripePromise = useMemo(
    () => (setup ? stripePromiseFor(setup.publishableKey) : null),
    [setup],
  );

  async function startAddCard() {
    setAdding(true);
    setError(null);
    try {
      const next = await createPaymentSetupIntent();
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
    if (!window.confirm("Remove this card from your account?")) return;
    setError(null);
    try {
      await deleteCustomerPaymentMethod(id);
      setMethods((current) => current.filter((method) => method.id !== id));
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove this card.",
      );
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading saved cards…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {!configured && (
        <p className="rounded-xl border border-lavender/40 bg-lavender-light/30 px-4 py-3 text-sm text-text-muted">
          Online card setup is not available yet. Please contact the Atelier to
          save a payment method.
        </p>
      )}

      {methods.length === 0 && !setup ? (
        <div className="rounded-xl border border-dashed border-lavender/50 bg-lavender-light/30 px-4 py-8 text-center text-sm text-text-muted">
          No saved cards yet. Add a valid card before creating a pet profile.
        </div>
      ) : (
        <ul className="space-y-3">
          {methods.map((method) => (
            <li
              key={method.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-lavender/40 bg-cream px-4 py-3"
            >
              <div>
                <p className="text-sm text-text">{formatPaymentMethodLabel(method)}</p>
                {method.isDefault && (
                  <p className="mt-1 text-xs text-text-muted">Default</p>
                )}
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
        <div className="rounded-xl border border-lavender/40 bg-cream p-4">
          <p className="mb-4 text-sm font-medium text-gold-dark">Add a card</p>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: setup.clientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <AddCardForm
              onSaved={(method) => {
                setMethods((current) => {
                  if (current.some((item) => item.id === method.id)) {
                    return current.map((item) =>
                      item.id === method.id ? method : item,
                    );
                  }
                  return [...current, method];
                });
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
        configured && (
          <button
            type="button"
            onClick={() => void startAddCard()}
            disabled={adding}
            className="rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm font-medium text-gold-dark disabled:opacity-60"
          >
            {adding ? "Preparing…" : "+ Add a card"}
          </button>
        )
      )}
    </div>
  );
}

export function PaymentRequiredNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-champagne/40 bg-cream px-4 py-4"
          : "rounded-xl border border-lavender/40 bg-lavender-light/30 px-4 py-5"
      }
    >
      <p className="text-sm text-text">
        A valid payment method must be on file before you can save a pet
        profile. You will not be charged when you add a card.
      </p>
      <a
        href="/account/payment"
        className="mt-3 inline-flex rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white"
      >
        Add a payment method
      </a>
    </div>
  );
}
