"use client";

import React, { useEffect, useState, type FormEvent } from "react";
import { REFERRAL_SOURCE_OPTIONS } from "@/lib/profiles/referral-source";

type ReferralDetails = {
  source: string | null;
  name: string | null;
  balanceCents: number;
};

const previewDetails: ReferralDetails = { source: null, name: null, balanceCents: 0 };
const fieldClass = "mt-1 block w-full rounded-xl border border-lavender/40 bg-cream px-3 py-2";

function balanceText(cents: number) {
  return (cents / 100).toFixed(2);
}

export function StaffCustomerReferrals({ customerId, preview = false }: {
  customerId: string;
  preview?: boolean;
}) {
  const url = `/api/admin/customers/${customerId}/referrals`;
  const [details, setDetails] = useState<ReferralDetails | null>(preview ? previewDetails : null);
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState(preview ? "0.00" : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function showDetails(value: ReferralDetails) {
    setDetails(value);
    setSource(value.source ?? "");
    setName(value.name ?? "");
    setBalance(balanceText(value.balanceCents));
  }

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load referral details.");
        if (!controller.signal.aborted) showDetails(body);
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [preview, url]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details || saving || preview) return;
    setError("");
    setSaved(false);

    const balanceChanged = balance.trim() !== balanceText(details.balanceCents);
    const targetBalanceCents = balanceChanged ? Math.round(Number(balance) * 100) : null;
    if (targetBalanceCents !== null &&
        (!/^\d+(?:\.\d{1,2})?$/.test(balance.trim()) ||
          targetBalanceCents > 2_147_483_647)) {
      setError("Enter a non-negative amount with up to two decimal places.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, name, expectedBalanceCents: details.balanceCents, targetBalanceCents }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save referral details.");
      showDetails(body);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save referral details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t border-lavender/30 pt-6">
      <h3 className="text-base font-medium text-gold-dark">Referrals</h3>
      {details ? (
        <form className="mt-4 space-y-3 text-sm" onSubmit={handleSubmit}>
          <fieldset disabled={saving || preview} className="grid gap-3 sm:grid-cols-2">
            <label>
              Referral source
              <select className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="">Not provided</option>
                {REFERRAL_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Available referral credit (USD)
              <input className={fieldClass} inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
            </label>
            {source === "referral" ? (
              <label>
                Referrer name
                <input className={fieldClass} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-xl bg-gold px-4 py-2 text-white disabled:opacity-60">
                {saving ? "Saving…" : "Save referral details"}
              </button>
            </div>
          </fieldset>
        </form>
      ) : !error ? <p className="mt-2 text-sm text-text-muted">Loading referral details…</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-800">{error}</p> : null}
      {saved ? <p role="status" className="mt-2 text-sm">Referral details saved.</p> : null}
    </section>
  );
}
