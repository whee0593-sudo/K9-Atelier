"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { referralSharePath } from "@/lib/referrals/codes";
import { centsToDollars } from "@/lib/referrals/eligible";

type ReferralView = {
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

export function ReferralRewardsPanel() {
  const [view, setView] = useState<ReferralView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/account/referrals", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as ReferralView & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load referral rewards.");
        if (!cancelled) setView(body);
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
  }, []);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  if (error) {
    return <p className="text-sm text-text-muted">{error}</p>;
  }
  if (!view) {
    return <p className="text-sm text-text-muted">Loading referral rewards…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-lavender/30 bg-cream p-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Available Referral Credit
        </p>
        <p className="font-display mt-2 text-4xl text-ink">
          ${view.availableLabel}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Share a pet’s referral code. After a friend’s first completed and paid
          visit, you receive Referral Credit equal to their 10% savings. Credit
          can be applied at checkout after a future appointment.
        </p>
      </div>

      <div>
        <h3 className="font-medium text-gold-dark">Your referral codes</h3>
        {view.codes.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            Add a pet profile to receive a personalized referral code.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {view.codes.map((row) => {
              const shareUrl =
                typeof window === "undefined"
                  ? referralSharePath(row.code)
                  : `${window.location.origin}${referralSharePath(row.code)}`;
              return (
                <li
                  key={row.code}
                  className="rounded-2xl border border-lavender/30 bg-cream p-4"
                >
                  <p className="font-medium text-ink">{row.petName}</p>
                  <p className="mt-1 font-mono text-sm tracking-wide text-gold-dark">
                    {row.code}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => void copy(`${row.code}-code`, row.code)}
                      className="underline decoration-champagne/70 underline-offset-4"
                    >
                      {copied === `${row.code}-code` ? "Copied" : "Copy code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(`${row.code}-link`, shareUrl)}
                      className="underline decoration-champagne/70 underline-offset-4"
                    >
                      {copied === `${row.code}-link` ? "Copied" : "Copy share link"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-medium text-gold-dark">Referral rewards</h3>
        {view.rewards.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            Rewards appear here after a referred household’s first visit is
            completed and paid.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-lavender/30">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-lavender-light/50 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Referral</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {view.rewards.map((row) => (
                  <tr key={row.id} className="border-t border-lavender/20">
                    <td className="px-4 py-3">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{row.referral}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-3 capitalize">
                      {row.status.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3">{money(row.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-sm text-text-muted">
        <Link href="/referrals" className="underline decoration-champagne/70 underline-offset-4">
          View full Referral Rewards rules
        </Link>
      </p>
    </div>
  );
}
