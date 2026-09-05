"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatChargeMoney, sumLineItems } from "@/lib/charges/money";
import {
  centsToDollars,
  quoteReferralApplication,
  type ReferralApplyMode,
} from "@/lib/referrals/eligible";
import type { ReferralChargeCategory } from "@/lib/charges/types";
import {
  hourlyAmountFromTimes,
  hourlyRateForCatalogId,
} from "@/lib/charges/hourly";
import { HourlyVisitTimer } from "@/components/admin/HourlyVisitTimer";
import { ChargeReceiptActions } from "@/components/admin/ChargeReceiptActions";
import { ChargeReceiptLetter } from "@/components/admin/ChargeReceiptLetter";
import { ChargeRefundForm } from "@/components/admin/ChargeRefundForm";
import {
  collectBillHeading,
  formatReceiptPaymentMethod,
} from "@/lib/charges/receipt-view";
import type {
  AppointmentChargeRecord,
  CatalogChargeItem,
  ChargeKind,
  ChargeLineItem,
  CollectContext,
} from "@/lib/charges/types";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { ServiceCategoryPicker } from "@/components/admin/ServiceCategoryPicker";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";

const TIP_PERCENTS = [15, 18, 20] as const;

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function stripePromiseFor(publishableKey: string) {
  const existing = stripePromiseCache.get(publishableKey);
  if (existing) return existing;
  const promise = loadStripe(publishableKey, { locale: "en" });
  stripePromiseCache.set(publishableKey, promise);
  return promise;
}

function newLineId() {
  return crypto.randomUUID();
}

type Step = "review" | "pay" | "receipt" | "refund";

export function CollectCheckout({
  appointmentId,
  kind,
  preview = false,
  initialStep = "review",
  brandLinks,
}: {
  appointmentId: string;
  kind: ChargeKind;
  preview?: boolean;
  initialStep?: Step;
  brandLinks?: {
    websiteUrl: string;
    instagramUrl: string | null;
    googleReviewUrl: string | null;
  };
}) {
  const [context, setContext] = useState<CollectContext | null>(null);
  const [lineItems, setLineItems] = useState<ChargeLineItem[]>([]);
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [tipMode, setTipMode] = useState<"15" | "18" | "20" | "custom">("18");
  const [customTip, setCustomTip] = useState("0");
  const [step, setStep] = useState<Step>(initialStep);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceStartedAt, setServiceStartedAt] = useState<string | null>(null);
  const [serviceEndedAt, setServiceEndedAt] = useState<string | null>(null);
  const [paidCharge, setPaidCharge] = useState<AppointmentChargeRecord | null>(
    null,
  );
  const [chargedMethodId, setChargedMethodId] = useState<string | null>(null);
  const [receiptSent, setReceiptSent] = useState(false);
  const [referralMode, setReferralMode] = useState<ReferralApplyMode>("none");
  const [referralCustom, setReferralCustom] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralCodeStatus, setReferralCodeStatus] = useState<
    "idle" | "applied" | "invalid"
  >("idle");
  const [referralCodeMessage, setReferralCodeMessage] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (preview) {
      const body = buildPreviewCollectContext({
        paid: initialStep === "receipt" || initialStep === "refund",
      });
      setContext(body);
      setLineItems(
        kind === "no_show"
          ? [
              {
                id: newLineId(),
                label: "No-show fee",
                amount: body.appointment.estimatedTotal ?? 0,
                catalogId: "no-show",
              },
            ]
          : body.lineItems,
      );
      setMethods(body.methods);
      setSelectedMethodId(body.selectedPaymentMethodId);
      setServiceStartedAt(body.appointment.serviceStartedAt);
      setServiceEndedAt(body.appointment.serviceEndedAt);
      const previewPaid =
        body.paidCharges.find((charge) => charge.kind === kind) ?? null;
      setPaidCharge(previewPaid);
      if (previewPaid) setChargeId(previewPaid.id);
      if (previewPaid) setChargedMethodId(body.selectedPaymentMethodId);
      const existingCode = body.referral?.referralCode?.trim() ?? "";
      setReferralCode(existingCode);
      setReferralCodeStatus(existingCode ? "applied" : "idle");
      setReferralCodeMessage(
        existingCode ? "Referral code already on file for this household." : null,
      );
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/admin/collect/${appointmentId}`, {
        credentials: "include",
      });
      const body = (await response.json()) as CollectContext & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not load this appointment.");
        return;
      }
      setContext(body);
      setLineItems(
        kind === "no_show"
          ? [
              {
                id: newLineId(),
                label: "No-show fee",
                amount: body.appointment.estimatedTotal ?? 0,
                catalogId: "no-show",
              },
            ]
          : body.lineItems,
      );
      setMethods(body.methods);
      setSelectedMethodId(body.selectedPaymentMethodId);
      setServiceStartedAt(body.appointment.serviceStartedAt);
      setServiceEndedAt(body.appointment.serviceEndedAt);
      const loadedPaid =
        (body.paidCharges ?? []).find((charge) => charge.kind === kind) ?? null;
      setPaidCharge(loadedPaid);
      if (loadedPaid) setChargeId(loadedPaid.id);
      const existingCode = body.referral?.referralCode?.trim() ?? "";
      setReferralCode(existingCode);
      setReferralCodeStatus(existingCode ? "applied" : "idle");
      setReferralCodeMessage(
        existingCode ? "Referral code already on file for this household." : null,
      );
    } catch {
      setError("Could not load this appointment.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, kind, preview, initialStep]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!serviceStartedAt || serviceEndedAt) return;
    function syncHourlyAmount() {
      setLineItems((current) =>
        current.map((item) => {
          const rate = hourlyRateForCatalogId(item.catalogId);
          if (!rate || !serviceStartedAt) return item;
          return {
            ...item,
            amount: hourlyAmountFromTimes(
              serviceStartedAt,
              serviceEndedAt,
              rate,
            ),
          };
        }),
      );
    }
    syncHourlyAmount();
    const timer = window.setInterval(syncHourlyAmount, 1000);
    return () => window.clearInterval(timer);
  }, [serviceStartedAt, serviceEndedAt]);

  const subtotal = sumLineItems(lineItems);
  const tipAmount =
    kind === "no_show"
      ? 0
      : tipMode === "custom"
        ? Math.max(0, Number(customTip) || 0)
        : Math.round(subtotal * (Number(tipMode) / 100) * 100) / 100;
  const referralQuote = quoteReferralApplication({
    lineItems,
    tipAmount,
    availableCreditCents: context?.referral?.availableCreditCents ?? 0,
    mode: kind === "service" ? referralMode : "none",
    customDollars: Number(referralCustom) || 0,
    applyNewClientDiscount: Boolean(
      kind === "service" && context?.referral?.applyNewClientDiscount,
    ),
  });
  const total = centsToDollars(referralQuote.dueCents);
  const alreadyPaid = Boolean(paidCharge || context?.paidKinds.includes(kind));

  useEffect(() => {
    if (alreadyPaid && step === "review") setStep("receipt");
  }, [alreadyPaid, step]);

  const receiptCharge: AppointmentChargeRecord | null =
    paidCharge ??
    (chargeId
      ? {
          id: chargeId,
          appointmentId,
          kind,
          status: "paid",
          lineItems,
          subtotal,
          tipAmount,
          total,
          receiptChannel: null,
          paidAt: new Date().toISOString(),
          refundedAmount: 0,
        }
      : null);

  function updateItem(id: string, patch: Partial<ChargeLineItem>) {
    setLineItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addCatalogItem(catalog: CatalogChargeItem) {
    setLineItems((current) => [
      ...current,
      {
        id: newLineId(),
        label: catalog.name,
        amount: catalog.suggestedAmount ?? 0,
        catalogId: catalog.id,
        referralCategory:
          catalog.id === "travel-fee"
            ? "travel_fee"
            : catalog.id === "behavior-fee" || catalog.id === "flea-tick-fee"
              ? "special_handling"
              : "eligible_service",
      },
    ]);
  }

  function addCustomItem() {
    setLineItems((current) => [
      ...current,
      {
        id: newLineId(),
        label: "Additional care",
        amount: 0,
        referralCategory: "other_ineligible",
      },
    ]);
  }

  async function applyReferralCode(codeInput?: string) {
    const code = (codeInput ?? referralCode).trim();
    if (!code) {
      setReferralCodeStatus("idle");
      setReferralCodeMessage(null);
      return;
    }
    if (!context) return;

    if (preview) {
      setContext({
        ...context,
        referral: {
          availableCreditCents: context.referral?.availableCreditCents ?? 0,
          applyNewClientDiscount: true,
          canUseCredit: false,
          referralCode: code.toUpperCase(),
        },
      });
      setReferralCode(code.toUpperCase());
      setReferralCodeStatus("applied");
      setReferralCodeMessage(
        "Referral code applied. First-visit 10% will be calculated on eligible services.",
      );
      setReferralMode("none");
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/collect/${appointmentId}/referral`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        referral?: NonNullable<CollectContext["referral"]>;
      };
      if (!response.ok || !body.referral) {
        setReferralCodeStatus("invalid");
        setReferralCodeMessage(body.error ?? "Could not apply this referral code.");
        setError(body.error ?? "Could not apply this referral code.");
        return;
      }
      setContext({
        ...context,
        referral: body.referral,
      });
      setReferralCode(body.referral.referralCode ?? code.toUpperCase());
      setReferralCodeStatus("applied");
      setReferralCodeMessage(
        body.message ??
          "Referral code applied. First-visit 10% will be calculated on eligible services.",
      );
      if (body.referral.applyNewClientDiscount) {
        setReferralMode("none");
      }
    } catch {
      setReferralCodeStatus("invalid");
      setReferralCodeMessage("Could not apply this referral code.");
      setError("Could not apply this referral code.");
    } finally {
      setBusy(false);
    }
  }

  async function startPayment() {
    if (!context) return;
    if (preview) {
      const nextCharge: AppointmentChargeRecord = {
        id: "preview-charge",
        appointmentId,
        kind,
        status: "paid",
        lineItems,
        subtotal,
        tipAmount,
        total,
        receiptChannel: null,
        paidAt: new Date().toISOString(),
        refundedAmount: 0,
      };
      setChargeId(nextCharge.id);
      setPaidCharge(nextCharge);
      if (!useNewCard) setChargedMethodId(selectedMethodId);
      setStep("receipt");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/charges", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          kind,
          lineItems,
          tipAmount,
          paymentMethodId: useNewCard ? undefined : selectedMethodId,
          useNewCard,
          referralMode: kind === "service" ? referralMode : "none",
          referralCustomDollars: Number(referralCustom) || 0,
          referralCode:
            kind === "service" ? referralCode.trim() || undefined : undefined,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        charge?: { id: string };
        clientSecret?: string;
        requiresAction?: boolean;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not charge this card.");
        return;
      }
      if (body.charge?.id) setChargeId(body.charge.id);
      if (!useNewCard) setChargedMethodId(selectedMethodId);
      if (body.requiresAction && body.clientSecret) {
        if (kind === "no_show") {
          setError(
            "This card needs the customer present. Open Collect payment instead.",
          );
          return null;
        }
        setClientSecret(body.clientSecret);
        if (!useNewCard && context.stripePublishableKey && body.charge?.id) {
          const stripe = await (
            await loadStripe(context.stripePublishableKey, { locale: "en" })
          );
          if (!stripe) {
            setError("Could not verify this card.");
            return null;
          }
          const confirmed = await stripe.confirmCardPayment(body.clientSecret);
          if (confirmed.error || confirmed.paymentIntent?.status !== "succeeded") {
            setError(
              confirmed.error?.message ?? "This card could not be charged.",
            );
            return null;
          }
          const confirmResponse = await fetch(
            `/api/admin/charges/${body.charge.id}/confirm`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentIntentId: confirmed.paymentIntent.id,
              }),
            },
          );
          if (!confirmResponse.ok) {
            setError("Payment needs a moment — please try again.");
            return null;
          }
          setStep("receipt");
          return null;
        }
        return body.clientSecret;
      }
      setStep("receipt");
    } catch {
      setError("Could not charge this card.");
    } finally {
      setBusy(false);
    }
    return null;
  }

  async function sendReceiptEmail() {
    if (preview) {
      setReceiptSent(true);
      return;
    }
    if (!chargeId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/charges/${chargeId}/receipt`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email" }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not send the email receipt.");
        return;
      }
      setReceiptSent(true);
    } catch {
      setError("Could not send the email receipt.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRefund(amount: number) {
    if (!receiptCharge) return;
    if (preview) {
      setPaidCharge({
        ...receiptCharge,
        refundedAmount: Math.round(
          ((receiptCharge.refundedAmount ?? 0) + amount) * 100,
        ) / 100,
      });
      setStep("receipt");
      return;
    }
    if (!chargeId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/charges/${chargeId}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const body = (await response.json()) as {
        error?: string;
        charge?: AppointmentChargeRecord;
      };
      if (!response.ok || !body.charge) {
        setError(body.error ?? "Could not refund this payment.");
        return;
      }
      setPaidCharge(body.charge);
      setStep("receipt");
    } catch {
      setError("Could not refund this payment.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="font-body text-sm text-taupe">Preparing today’s bill…</p>
    );
  }

  if (!context) {
    return (
      <div>
        <p className="font-body text-sm text-red-800">{error}</p>
        <Link href="/admin/appointments" className="mt-4 inline-block text-sm underline">
          Back to appointments
        </Link>
      </div>
    );
  }

  const appointment = context.appointment;

  return (
    <div className="mx-auto w-full max-w-[560px]">
      {preview ? (
        <p className="mb-4 rounded-xl border border-champagne bg-cream px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-taupe">
          Preview only · no charge
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {!alreadyPaid && step === "review" ? (
        <section>
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
            Staff review
          </p>
          <h1 className="font-display mt-3 text-4xl text-ink">
            {kind === "no_show" ? "Charge no-show" : "Confirm today’s bill"}
          </h1>
          <p className="font-body mt-3 text-sm text-taupe">
            {appointment.petName}
            {appointment.customerName ? ` · ${appointment.customerName}` : ""}
          </p>

          <ul className="mt-8 space-y-4">
            {lineItems.map((item, index) => (
              <li
                key={item.id}
                className="rounded-2xl border border-lavender/40 bg-cream p-4"
              >
                {index === 0 && kind !== "no_show" && (context.catalogGroups?.length ?? 0) > 0 ? (
                  <ServiceCategoryPicker
                    groups={context.catalogGroups ?? []}
                    selectedId={item.catalogId}
                    selectedLabel={item.label}
                    onSelect={(catalog) =>
                      updateItem(item.id, {
                        label: catalog.name,
                        amount: catalog.suggestedAmount ?? item.amount,
                        catalogId: catalog.id,
                      })
                    }
                  />
                ) : (
                  <input
                    value={item.label}
                    onChange={(event) =>
                      updateItem(item.id, { label: event.target.value })
                    }
                    className="w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
                  />
                )}
                {hourlyRateForCatalogId(item.catalogId) != null ? (
                  <HourlyVisitTimer
                    appointmentId={appointmentId}
                    preview={preview}
                    rate={hourlyRateForCatalogId(item.catalogId) ?? 150}
                    startedAt={serviceStartedAt}
                    endedAt={serviceEndedAt}
                    timeZone={appointment.timezone}
                    onTimesChange={({ startedAt, endedAt }) => {
                      setServiceStartedAt(startedAt);
                      setServiceEndedAt(endedAt);
                      const rate = hourlyRateForCatalogId(item.catalogId);
                      if (!rate || !startedAt) return;
                      updateItem(item.id, {
                        amount: hourlyAmountFromTimes(startedAt, endedAt, rate),
                      });
                    }}
                  />
                ) : null}
                <div className="mt-3 flex items-center gap-3">
                  <label className="font-body text-xs text-taupe">
                    Amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(event) =>
                        updateItem(item.id, {
                          amount: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
                  />
                  </label>
                  <label className="font-body text-xs text-taupe">
                    Referral
                    <select
                      value={item.referralCategory ?? "other_ineligible"}
                      onChange={(event) =>
                        updateItem(item.id, {
                          referralCategory: event.target
                            .value as ReferralChargeCategory,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
                    >
                      <option value="eligible_service">Eligible service</option>
                      <option value="travel_fee">Travel fee</option>
                      <option value="special_handling">Special handling</option>
                      <option value="gratuity">Gratuity</option>
                      <option value="other_ineligible">Not eligible</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLineItems((current) =>
                        current.filter((entry) => entry.id !== item.id),
                      )
                    }
                    className="mt-5 text-sm text-red-800 underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-3">
            <label className="font-body text-sm text-taupe">
              Add a service
              <select
                defaultValue=""
                onChange={(event) => {
                  const catalog = (context.catalogGroups ?? [])
                    .flatMap((group) => group.items)
                    .find((item) => item.id === event.target.value);
                  if (catalog) addCatalogItem(catalog);
                  event.target.value = "";
                }}
                className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">Choose a service to add</option>
                {(context.catalogGroups ?? []).map((group) => (
                  <optgroup key={group.id} label={group.name}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.suggestedAmount != null
                          ? ` · ${formatChargeMoney(item.suggestedAmount)}`
                          : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addCustomItem}
              className="text-left text-sm text-ink underline"
            >
              Add a custom line
            </button>
          </div>

          <p className="font-display mt-8 text-3xl text-ink">
            {formatChargeMoney(subtotal)}
          </p>

          {kind === "no_show" ? (
            <div className="mt-6 space-y-2">
              <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
                Charge saved card
              </p>
              {methods.length === 0 ? (
                <p className="font-body text-sm text-red-800">
                  This guest has no card on file.
                </p>
              ) : (
                methods.map((method) => (
                  <label
                    key={method.id}
                    className="flex items-center gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="no-show-card"
                      checked={selectedMethodId === method.id}
                      onChange={() => setSelectedMethodId(method.id)}
                    />
                    {formatPaymentMethodLabel(method)}
                  </label>
                ))
              )}
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              busy ||
              lineItems.length === 0 ||
              (kind === "no_show" && !selectedMethodId)
            }
            onClick={() => {
              if (kind === "no_show") {
                void startPayment();
                return;
              }
              setStep("pay");
            }}
            className="mt-6 w-full rounded-sm bg-deep-lavender px-6 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ivory disabled:opacity-50"
          >
            {kind === "no_show" ? "Charge saved card" : "Present to customer"}
          </button>
        </section>
      ) : null}

      {step === "pay" && context ? (
        <PayStep
          context={context}
          lineItems={lineItems}
          subtotal={subtotal}
          tipMode={tipMode}
          customTip={customTip}
          tipAmount={tipAmount}
          total={total}
          referralQuote={referralQuote}
          referralMode={referralMode}
          referralCustom={referralCustom}
          referralCode={referralCode}
          referralCodeStatus={referralCodeStatus}
          referralCodeMessage={referralCodeMessage}
          methods={methods}
          selectedMethodId={selectedMethodId}
          useNewCard={useNewCard}
          busy={busy}
          clientSecret={clientSecret}
          chargeId={chargeId}
          onTipMode={setTipMode}
          onCustomTip={setCustomTip}
          onReferralMode={setReferralMode}
          onReferralCustom={setReferralCustom}
          onReferralCodeChange={(value) => {
            setReferralCode(value.toUpperCase());
            setReferralCodeStatus("idle");
            setReferralCodeMessage(null);
          }}
          onApplyReferralCode={() => void applyReferralCode()}
          onSelectMethod={(id) => {
            setSelectedMethodId(id);
            setUseNewCard(false);
          }}
          onUseNewCard={() => {
            setUseNewCard(true);
            setSelectedMethodId(null);
          }}
          onBack={() => setStep("review")}
          onPay={() => startPayment()}
          onPaid={() => setStep("receipt")}
          onError={setError}
          onBusy={setBusy}
        />
      ) : null}

      {step === "receipt" && receiptCharge ? (
        <section>
          <ChargeReceiptLetter
            appointment={appointment}
            charge={receiptCharge}
            paymentMethodLabel={formatReceiptPaymentMethod(
              methods.find((method) => method.id === chargedMethodId) ?? null,
            )}
            websiteUrl={brandLinks?.websiteUrl}
            instagramUrl={brandLinks?.instagramUrl}
            googleReviewUrl={brandLinks?.googleReviewUrl}
          />
          <ChargeReceiptActions
            customerEmail={appointment.customerEmail}
            busy={busy}
            sent={receiptSent}
            onSendEmail={() => void sendReceiptEmail()}
          />
        </section>
      ) : null}

      {step === "refund" && receiptCharge ? (
        <ChargeRefundForm
          charge={receiptCharge}
          busy={busy}
          onBack={() => setStep("receipt")}
          onRefund={(amount) => void submitRefund(amount)}
        />
      ) : null}
    </div>
  );
}

function PayStep({
  context,
  lineItems,
  subtotal,
  tipMode,
  customTip,
  tipAmount,
  total,
  referralQuote,
  referralMode,
  referralCustom,
  referralCode,
  referralCodeStatus,
  referralCodeMessage,
  methods,
  selectedMethodId,
  useNewCard,
  busy,
  clientSecret,
  chargeId,
  onTipMode,
  onCustomTip,
  onReferralMode,
  onReferralCustom,
  onReferralCodeChange,
  onApplyReferralCode,
  onSelectMethod,
  onUseNewCard,
  onBack,
  onPay,
  onPaid,
  onError,
  onBusy,
}: {
  context: CollectContext;
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipMode: "15" | "18" | "20" | "custom";
  customTip: string;
  tipAmount: number;
  total: number;
  referralQuote: ReturnType<typeof quoteReferralApplication>;
  referralMode: ReferralApplyMode;
  referralCustom: string;
  referralCode: string;
  referralCodeStatus: "idle" | "applied" | "invalid";
  referralCodeMessage: string | null;
  methods: PaymentMethodRecord[];
  selectedMethodId: string | null;
  useNewCard: boolean;
  busy: boolean;
  clientSecret: string | null;
  chargeId: string | null;
  onTipMode: (value: "15" | "18" | "20" | "custom") => void;
  onCustomTip: (value: string) => void;
  onReferralMode: (value: ReferralApplyMode) => void;
  onReferralCustom: (value: string) => void;
  onReferralCodeChange: (value: string) => void;
  onApplyReferralCode: () => void;
  onSelectMethod: (id: string) => void;
  onUseNewCard: () => void;
  onBack: () => void;
  onPay: () => Promise<string | null | void>;
  onPaid: () => void;
  onError: (message: string | null) => void;
  onBusy: (value: boolean) => void;
}) {
  const stripePromise = useMemo(
    () => stripePromiseFor(context.stripePublishableKey),
    [context.stripePublishableKey],
  );

  return (
    <section>
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Today’s bill
      </p>
      <h2 className="font-display mt-3 text-4xl text-ink">
        {collectBillHeading(context.appointment)}
      </h2>
      <ul className="mt-8 space-y-3">
        {lineItems.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-4 font-body text-sm text-ink"
          >
            <span>{item.label}</span>
            <span>{formatChargeMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="font-body mt-4 flex justify-between text-sm text-taupe">
        <span>Subtotal</span>
        <span>{formatChargeMoney(subtotal)}</span>
      </p>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Tip
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {TIP_PERCENTS.map((percent) => (
          <button
            key={percent}
            type="button"
            onClick={() => onTipMode(String(percent) as "15" | "18" | "20")}
            className={`rounded-sm py-3 text-sm ${
              tipMode === String(percent)
                ? "bg-deep-lavender text-ivory"
                : "border border-lavender/50 text-ink"
            }`}
          >
            {percent}%
          </button>
        ))}
        <button
          type="button"
          onClick={() => onTipMode("custom")}
          className={`rounded-sm py-3 text-sm ${
            tipMode === "custom"
              ? "bg-deep-lavender text-ivory"
              : "border border-lavender/50 text-ink"
          }`}
        >
          Custom
        </button>
      </div>
      {tipMode === "custom" ? (
        <input
          type="number"
          min="0"
          step="0.01"
          value={customTip}
          onChange={(event) => onCustomTip(event.target.value)}
          className="mt-3 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm"
          placeholder="0"
        />
      ) : null}
      <p className="font-body mt-2 text-sm text-taupe">
        Tip {formatChargeMoney(tipAmount)}
      </p>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Referral code
      </p>
      <label className="font-body mt-2 block text-sm text-ink" htmlFor="collect-referral-code">
        Have a friend&apos;s referral code?
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="collect-referral-code"
          type="text"
          autoComplete="off"
          value={referralCode}
          disabled={busy || referralCodeStatus === "applied"}
          onChange={(event) => onReferralCodeChange(event.target.value)}
          onBlur={() => {
            if (referralCode.trim() && referralCodeStatus !== "applied") {
              onApplyReferralCode();
            }
          }}
          className="w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm uppercase tracking-[0.08em] text-ink disabled:opacity-70"
          placeholder="PRINCE-PENNY-S"
        />
        <button
          type="button"
          disabled={busy || !referralCode.trim() || referralCodeStatus === "applied"}
          onClick={onApplyReferralCode}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-sm border border-champagne px-4 text-[10px] font-medium uppercase tracking-[0.14em] text-ink disabled:opacity-50"
        >
          {referralCodeStatus === "applied" ? "Applied" : "Apply code"}
        </button>
      </div>
      {referralCodeMessage ? (
        <p
          className={`font-body mt-2 text-sm ${
            referralCodeStatus === "invalid" ? "text-red-800" : "text-ink"
          }`}
        >
          {referralCodeMessage}
        </p>
      ) : (
        <p className="font-body mt-2 text-xs text-taupe">
          Optional. Use this if the household did not enter a referral code when
          booking. New-client 10% applies only on a first paid visit.
        </p>
      )}

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Available referral credit
      </p>
      <p className="font-body mt-2 text-sm text-ink">
        You have {formatChargeMoney(centsToDollars(referralQuote.availableCreditCents))} in
        referral credit.
      </p>
      {context.referral?.applyNewClientDiscount ? (
        <p className="font-body mt-2 text-sm text-taupe">
          First-visit 10% is applied to eligible services. Referral credit cannot
          be combined with that discount.
        </p>
      ) : context.referral?.canUseCredit ? (
        <div className="mt-3 space-y-2">
          {(
            [
              ["none", "Do not apply referral credit"],
              ["full", "Apply full available balance"],
              ["custom", "Apply a custom amount"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm"
            >
              <input
                type="radio"
                name="referral-credit"
                checked={referralMode === value}
                onChange={() => onReferralMode(value)}
              />
              {label}
            </label>
          ))}
          {referralMode === "custom" ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={referralCustom}
              onChange={(event) => onReferralCustom(event.target.value)}
              className="w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm"
              placeholder="Enter amount"
            />
          ) : null}
        </div>
      ) : (
        <p className="font-body mt-2 text-sm text-taupe">
          No referral credit is available for this bill.
        </p>
      )}

      <ul className="font-body mt-6 space-y-2 text-sm text-taupe">
        <li className="flex justify-between gap-4">
          <span>Original amount</span>
          <span>{formatChargeMoney(centsToDollars(referralQuote.originalCents))}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Eligible services</span>
          <span>{formatChargeMoney(centsToDollars(referralQuote.eligibleCents))}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Travel, handling & other excluded fees</span>
          <span>{formatChargeMoney(centsToDollars(referralQuote.excludedCents))}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Tip</span>
          <span>{formatChargeMoney(centsToDollars(referralQuote.tipCents))}</span>
        </li>
        {referralQuote.discountCents > 0 ? (
          <li className="flex justify-between gap-4 text-ink">
            <span>New client 10%</span>
            <span>-{formatChargeMoney(centsToDollars(referralQuote.discountCents))}</span>
          </li>
        ) : null}
        <li className="flex justify-between gap-4 text-ink">
          <span>Referral credit applied</span>
          <span>-{formatChargeMoney(centsToDollars(referralQuote.creditCents))}</span>
        </li>
      </ul>
      <p className="font-display mt-6 text-4xl text-ink">
        {formatChargeMoney(total)}
      </p>
      <p className="font-body mt-3 text-xs text-taupe">
        Referral Credit applies to eligible service charges only. Travel fees,
        special handling fees and gratuities are excluded. Referral Credit cannot
        be combined with other promotional offers.{" "}
        <a href="/referrals" className="underline">
          View Referral Terms
        </a>
      </p>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Payment
      </p>
      <div className="mt-3 space-y-2">
        {methods.map((method) => (
          <label
            key={method.id}
            className="flex items-center gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm"
          >
            <input
              type="radio"
              name="collect-card"
              checked={!useNewCard && selectedMethodId === method.id}
              onChange={() => onSelectMethod(method.id)}
            />
            {formatPaymentMethodLabel(method)}
          </label>
        ))}
        <label className="flex items-center gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm">
          <input
            type="radio"
            name="collect-card"
            checked={useNewCard}
            onChange={onUseNewCard}
          />
          Add another payment method
        </label>
      </div>

      {useNewCard ? (
        <div className="mt-4">
          {clientSecret && chargeId ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: "stripe" } }}
            >
              <ConfirmNewCard
                chargeId={chargeId}
                onPaid={onPaid}
                onError={onError}
                onBusy={onBusy}
              />
            </Elements>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPay()}
              className="mt-4 w-full rounded-sm bg-gold px-6 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-50"
            >
              {busy ? "Preparing…" : "Continue with new card"}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !selectedMethodId}
          onClick={() => void onPay()}
          className="mt-8 w-full rounded-sm bg-gold px-6 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-50"
        >
          {busy ? "Charging…" : `Pay ${formatChargeMoney(total)}`}
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="font-body mt-4 w-full text-sm text-taupe underline"
      >
        Back to review
      </button>
    </section>
  );
}

function ConfirmNewCard({
  chargeId,
  onPaid,
  onError,
  onBusy,
}: {
  chargeId: string | null;
  onPaid: () => void;
  onError: (message: string | null) => void;
  onBusy: (value: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    if (!stripe || !elements || !chargeId) return;
    setSubmitting(true);
    onBusy(true);
    onError(null);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        onError(submitError.message ?? "Please complete the card details.");
        return;
      }
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/admin/appointments`,
        },
      });
      if (result.error) {
        onError(result.error.message ?? "This card could not be charged.");
        return;
      }
      const paymentIntent = result.paymentIntent;
      if (!paymentIntent?.id || paymentIntent.status !== "succeeded") {
        onError("This card could not be charged.");
        return;
      }
      const response = await fetch(`/api/admin/charges/${chargeId}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        onError(body.error ?? "Payment succeeded but could not be recorded.");
        return;
      }
      onPaid();
    } catch {
      onError("This card could not be charged.");
    } finally {
      setSubmitting(false);
      onBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        }}
      />
      <button
        type="button"
        disabled={submitting || !stripe}
        onClick={() => void handlePay()}
        className="w-full rounded-sm bg-gold px-6 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-50"
      >
        {submitting ? "Charging…" : "Pay now"}
      </button>
    </div>
  );
}
