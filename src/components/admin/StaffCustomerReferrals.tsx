"use client";

import React, { useEffect, useState } from "react";
import { centsToDollars } from "@/lib/referrals/eligible";

export type StaffReferralView = {
  availableCreditCents: number;
  availableLabel: string;
  codes: Array<{ petName: string; code: string }>;
  rewards: Array<{
    id: string;
    date: string;
    referral: string;
    code: string;
    status: string;
    amountCents: number;
    remainingCents: number;
  }>;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(centsToDollars(cents));
}

function ReferralViewBody({ view }: { view: StaffReferralView }) {
  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-xl border border-lavender/30 bg-cream px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Available Referral Credit
        </p>
        <p className="mt-1 text-2xl font-medium text-text">${view.availableLabel}</p>
      </div>
      <div>
        <h4 className="text-sm font-medium text-text">Referral codes</h4>
        {view.codes.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            Add a pet profile to generate a referral code.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {view.codes.map((row) => (
              <li key={row.code} className="rounded-xl border border-lavender/30 px-4 py-3">
                <p className="font-medium text-text">{row.petName}</p>
                <p className="mt-1 font-mono text-gold-dark">{row.code}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-sm font-medium text-text">Referral rewards</h4>
        {view.rewards.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No referral rewards yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {view.rewards.map((row) => (
              <li key={row.id} className="rounded-xl border border-lavender/30 px-4 py-3">
                <p className="font-medium text-text">
                  {row.referral} · {money(row.amountCents)}
                </p>
                <p className="mt-1 text-text-muted">
                  {row.code} · {row.status.replaceAll("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function StaffCustomerReferrals({
  customerId,
  preview = false,
  previewView,
}: {
  customerId: string;
  preview?: boolean;
  previewView?: StaffReferralView;
}) {
  const [view, setView] = useState<StaffReferralView | null>(previewView ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) {
      setView(
        previewView ?? {
          availableCreditCents: 0,
          availableLabel: "0.00",
          codes: [],
          rewards: [],
        },
      );
      return;
    }
    let cancelled = false;
    void fetch(`/api/admin/customers/${customerId}/referrals`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as StaffReferralView & {
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(body.error ?? "Could not load referral rewards.");
        }
        setView(body);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load referral rewards.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, preview, previewView]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium text-gold-dark">Referrals</h3>
        <a
          href="/admin/referrals"
          className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
        >
          Adjust on Referrals
        </a>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-800">{error}</p>
      ) : !view ? (
        <p className="mt-3 text-sm text-text-muted">Loading referral rewards…</p>
      ) : (
        <ReferralViewBody view={view} />
      )}
    </section>
  );
}
