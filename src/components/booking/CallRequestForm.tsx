"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CALL_REQUEST_CONSENT } from "@/lib/call-requests/core";
import { manualCardWallets } from "@/lib/payments/card-wallets";
import { bookingFieldClass as bookingInputClass, bookingLabelClass, bookingPrimaryBtnClass } from "@/components/booking/booking-ui";

type Reply = { error?: string; status?: string; name?: string; phone?: string; hasSetup?: boolean; received?: boolean; clientSecret?: string; publishableKey?: string; readyToComplete?: boolean };
type Setup = { clientSecret: string; publishableKey: string };
const stripeInstances = new Map<string, ReturnType<typeof loadStripe>>();
function stripeFor(key: string) {
  if (!stripeInstances.has(key)) stripeInstances.set(key, loadStripe(key, { locale: "en" }));
  return stripeInstances.get(key)!;
}
async function post(action: string, body = {}): Promise<Reply> {
  const response = await fetch(`/api/call-requests/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body) });
  const result = await response.json() as Reply;
  if (!response.ok) throw new Error(result.error || "Please try again or call us.");
  return result;
}

function CardForm({ contact, onSaved }: { contact: { name: string; phone: string }; onSaved: () => Promise<void> }) {
  const stripe = useStripe(); const elements = useElements();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true); setError("");
    try {
      const validation = await elements.submit();
      if (validation.error) throw new Error(validation.error.message || "Please complete your card details.");
      const result = await stripe.confirmSetup({ elements, confirmParams: {
        return_url: `${window.location.origin}/api/call-requests/return`,
        payment_method_data: { billing_details: contact },
      }, redirect: "if_required" });
      if (result.error) throw new Error(result.error.message || "Your card could not be saved. Please try again.");
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Card setup failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-6">
    <PaymentElement options={{ wallets: manualCardWallets, fields: { billingDetails: { name: "never", phone: "never" } } }} />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={busy || !stripe || !elements} className={bookingPrimaryBtnClass}>{busy ? "Saving…" : "Save Card & Request a Call"}</button>
  </form>;
}

export function CallRequestForm({ configured, phoneHref, phoneLabel }: { configured: boolean; phoneHref: string; phoneLabel: string }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<"details" | "card" | "finish" | "success">("details");
  const [setup, setSetup] = useState<Setup | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(configured);
  const stripePromise = useMemo(() => setup ? stripeFor(setup.publishableKey) : null, [setup]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    async function recover() {
      try {
        const response = await fetch("/api/call-requests/session", { credentials: "same-origin", cache: "no-store" });
        const row = await response.json() as Reply;
        if (!response.ok) throw new Error(row.error || "Please try again.");
        if (cancelled) return;
        if (row.status === "requested" || row.status === "contacted") { setStage("success"); return; }
        setName(row.name ?? ""); setPhone(row.phone ?? "");
        if (row.hasSetup) {
          setConsent(true);
          const result = await post("setup", { name: row.name, phone: row.phone, consent: true });
          if (cancelled) return;
          if (result.received) setStage("success");
          else if (result.readyToComplete) setStage("finish");
          else if (result.clientSecret && result.publishableKey) { setSetup({ clientSecret: result.clientSecret, publishableKey: result.publishableKey }); setStage("card"); }
        }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Please try again."); }
      finally { if (!cancelled) setRecovering(false); }
    }
    // Stripe may return authentication parameters; ownership is checked by the server cookie.
    if (new URLSearchParams(window.location.search).has("setup_intent")) window.history.replaceState(null, "", window.location.pathname);
    void recover(); return () => { cancelled = true; };
  }, [configured]);

  async function prepare(event: FormEvent) {
    event.preventDefault(); if (busy || !configured) return;
    setBusy(true); setError("");
    try {
      await post("session");
      const result = await post("setup", { name, phone, consent });
      if (result.name && result.phone) { setName(result.name); setPhone(result.phone); }
      if (result.received) setStage("success");
      else if (result.readyToComplete) setStage("finish");
      else if (result.clientSecret && result.publishableKey) { setSetup({ clientSecret: result.clientSecret, publishableKey: result.publishableKey }); setStage("card"); }
      else throw new Error("Card setup is temporarily unavailable.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function finish() {
    setStage("finish"); setBusy(true); setError("");
    try { const result = await post("complete"); if (!result.received) throw new Error("Please try again."); setStage("success"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function restart() {
    setBusy(true); setError("");
    try { await post("session", { reset: true }); setSetup(null); setName(""); setPhone(""); setConsent(false); setStage("details"); }
    catch { setError("Please try again or call us."); } finally { setBusy(false); }
  }

  if (stage === "success") return <div role="status" className="space-y-5 text-base leading-relaxed text-ink">
    <h2 className="font-display text-3xl">Your call request is received.</h2>
    <p>Penny will contact you to discuss the details. Your appointment is not confirmed yet.</p>
    <p>Card saved securely. No charge today.</p>
  </div>;
  return <div className="space-y-6">
    {stage === "details" && <form onSubmit={prepare} className="space-y-6">
      <div><label htmlFor="call-name" className={bookingLabelClass}>Full name</label><input id="call-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} className={bookingInputClass} disabled={busy || recovering} /></div>
      <div><label htmlFor="call-phone" className={bookingLabelClass}>Phone number</label><input id="call-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} className={bookingInputClass} disabled={busy || recovering} /></div>
      <label className="flex min-h-11 items-start gap-3 text-base leading-relaxed text-ink"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1.5 h-5 w-5 shrink-0 accent-deep-lavender" disabled={busy || recovering} /><span>{CALL_REQUEST_CONSENT}</span></label>
      <button disabled={!configured || busy || recovering} type="submit" className={bookingPrimaryBtnClass}>{busy || recovering ? "Preparing…" : "Continue to Secure Card"}</button>
    </form>}
    {stage === "card" && setup && stripePromise && <>
      <p className="text-base text-ink">{name} · {phone}</p>
      <Elements stripe={stripePromise} options={{ clientSecret: setup.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#6b5873", colorText: "#2b2529", colorBackground: "#fffdf7", fontSizeBase: "16px" } } }}><CardForm contact={{ name, phone }} onSaved={finish} /></Elements>
    </>}
    {stage === "finish" && <button className={bookingPrimaryBtnClass} disabled={busy} onClick={() => void finish()}>{busy ? "Sending your request…" : "Finish Call Request"}</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!configured && <p className="text-base leading-relaxed text-ink">Secure card setup is temporarily unavailable. Please call <a href={phoneHref} className="underline underline-offset-4">{phoneLabel}</a>.</p>}
    <p className="text-base leading-relaxed text-ink">This is a callback request, not a confirmed appointment.</p>
    {configured && !recovering && <button type="button" onClick={() => void restart()} disabled={busy} className="min-h-11 text-sm text-deep-lavender underline underline-offset-4">Start again</button>}
  </div>;
}
