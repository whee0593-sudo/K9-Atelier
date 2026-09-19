"use client";

import { Elements } from "@stripe/react-stripe-js";
import { useEffect, useMemo, useState } from "react";
import {
  AddCardForm,
  stripePromiseFor,
} from "@/components/account/PaymentMethodsManager";
import {
  bookingBackLinkClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";
import {
  createPaymentSetupIntent,
  fetchCustomerPaymentMethods,
} from "@/lib/payments/client";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";

type Props = {
  initialPaymentMethodId?: string | null;
  onBack: () => void;
  onComplete: (method: PaymentMethodRecord) => void;
};

export function BookingPaymentStep({
  initialPaymentMethodId,
  onBack,
  onComplete,
}: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(initialPaymentMethodId ?? null);
  const [cardSetup, setCardSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCustomerPaymentMethods()
      .then((result) => {
        if (cancelled) return;
        setPaymentMethods(result.methods);
        const selected =
          result.methods.find((method) => method.id === initialPaymentMethodId) ??
          result.methods.find((method) => method.isDefault) ??
          result.methods[0];
        if (selected) setSelectedPaymentMethodId(selected.id);
        if (result.methods.length === 0) {
          setAddingCard(true);
          createPaymentSetupIntent()
            .then((next) => {
              if (!cancelled) setCardSetup(next);
            })
            .catch((startError) => {
              if (cancelled) return;
              setError(
                startError instanceof Error
                  ? startError.message
                  : "Card setup is not available yet.",
              );
              setAddingCard(false);
            });
        }
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load saved cards.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialPaymentMethodId]);

  const stripePromise = useMemo(
    () => (cardSetup ? stripePromiseFor(cardSetup.publishableKey) : null),
    [cardSetup],
  );

  async function startAddCard() {
    setAddingCard(true);
    setError(null);
    try {
      const next = await createPaymentSetupIntent();
      setCardSetup(next);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Card setup is not available yet.",
      );
      setAddingCard(false);
    }
  }

  function rememberCard(method: PaymentMethodRecord) {
    setPaymentMethods((current) => {
      if (current.some((item) => item.id === method.id)) {
        return current.map((item) => (item.id === method.id ? method : item));
      }
      return [...current, method];
    });
    setSelectedPaymentMethodId(method.id);
    setCardSetup(null);
    setAddingCard(false);
  }

  function handleContinue() {
    const selected = paymentMethods.find(
      (method) => method.id === selectedPaymentMethodId,
    );
    if (!selected) {
      setError(
        "Please add a payment method to reserve this appointment. You will not be charged now.",
      );
      if (!cardSetup && !addingCard) void startAddCard();
      return;
    }
    onComplete(selected);
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>
      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Payment
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Leave a card on file
      </h2>
      <p className="font-body mt-4 max-w-xl text-sm leading-relaxed text-taupe">
        Saving a payment method is how this appointment is reserved. You will
        not be charged at this stage. Payment is settled after your visit. Late
        cancellations and no-shows may be charged to this card according to our
        policy.
      </p>

      <div className={`${bookingNoticeClass} mt-8 space-y-4`}>
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
          No charge at booking
        </p>
        <p className="font-body text-sm leading-relaxed text-taupe">
          We verify and save the card only. There is no charge when you confirm.
        </p>
      </div>

      {loading ? (
        <p className="font-body mt-8 text-sm text-taupe">Preparing card setup…</p>
      ) : (
        <div className={`${bookingNoticeClass} mt-6 space-y-4`}>
          {paymentMethods.length > 0 ? (
            <ul className="space-y-3">
              {paymentMethods.map((method) => {
                const checked = selectedPaymentMethodId === method.id;
                return (
                  <li key={method.id}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="booking-payment-method"
                        checked={checked}
                        onChange={() => setSelectedPaymentMethodId(method.id)}
                        className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
                      />
                      <span className="font-body text-sm text-ink">
                        {formatPaymentMethodLabel(method)}
                        {method.isDefault ? " · Default" : ""}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : !cardSetup ? (
            <p className="font-body text-sm text-taupe">
              Add a valid card to reserve this appointment.
            </p>
          ) : null}

          {cardSetup && stripePromise ? (
            <div className="border-t border-gray-line/70 pt-4">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: cardSetup.clientSecret,
                  locale: "en",
                  appearance: { theme: "stripe" },
                }}
              >
                <AddCardForm
                  clientSecret={cardSetup.clientSecret}
                  returnUrl={
                    typeof window === "undefined"
                      ? undefined
                      : window.location.href
                  }
                  onSaved={rememberCard}
                  onCancel={() => {
                    setCardSetup(null);
                    setAddingCard(false);
                  }}
                />
              </Elements>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void startAddCard()}
              disabled={addingCard}
              className={
                paymentMethods.length > 0
                  ? "font-body text-xs text-ink underline"
                  : `${bookingSecondaryBtnClass} mt-2 inline-flex`
              }
            >
              {addingCard
                ? "Preparing…"
                : paymentMethods.length > 0
                  ? "Use a different card"
                  : "Add a payment method"}
            </button>
          )}
        </div>
      )}

      {error ? (
        <p
          className="font-body mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={loading}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        Continue
      </button>
    </section>
  );
}
