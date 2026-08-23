"use client";

import { useMemo, useState } from "react";
import { formatChargeMoney } from "@/lib/charges/money";
import type { AppointmentChargeRecord } from "@/lib/charges/types";

type RefundMode = "full" | "items" | "amount";

export function ChargeRefundForm({
  charge,
  busy,
  onBack,
  onRefund,
}: {
  charge: AppointmentChargeRecord;
  busy: boolean;
  onBack: () => void;
  onRefund: (amount: number) => void;
}) {
  const remaining =
    Math.round((charge.total - (charge.refundedAmount ?? 0)) * 100) / 100;
  const [mode, setMode] = useState<RefundMode>("full");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeTip, setIncludeTip] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const itemTotal = useMemo(() => {
    const lines = charge.lineItems
      .filter((item) => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + item.amount, 0);
    const tip = includeTip ? charge.tipAmount : 0;
    return Math.round((lines + tip) * 100) / 100;
  }, [charge.lineItems, charge.tipAmount, includeTip, selectedIds]);

  const amount =
    mode === "full"
      ? remaining
      : mode === "items"
        ? Math.min(itemTotal, remaining)
        : Math.min(Math.max(0, Number(customAmount) || 0), remaining);

  return (
    <section>
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Refund
      </p>
      <h1 className="font-display mt-3 text-4xl text-ink">Refund this payment</h1>
      <p className="font-body mt-3 text-sm text-taupe">
        Paid {formatChargeMoney(charge.total)}
        {(charge.refundedAmount ?? 0) > 0
          ? ` · already refunded ${formatChargeMoney(charge.refundedAmount ?? 0)}`
          : ""}
        . Remaining {formatChargeMoney(remaining)}.
      </p>

      <div className="mt-8 grid gap-3">
        {(
          [
            ["full", "Full refund"],
            ["items", "Refund selected items"],
            ["amount", "Refund a custom amount"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm"
          >
            <input
              type="radio"
              name="refund-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
              className="accent-deep-lavender"
            />
            {label}
          </label>
        ))}
      </div>

      {mode === "items" ? (
        <ul className="mt-6 space-y-3">
          {charge.lineItems.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() =>
                      setSelectedIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                    className="accent-deep-lavender"
                  />
                  {item.label}
                </span>
                <span>{formatChargeMoney(item.amount)}</span>
              </label>
            </li>
          ))}
          {charge.tipAmount > 0 ? (
            <li>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-lavender/40 bg-cream px-4 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeTip}
                    onChange={(event) => setIncludeTip(event.target.checked)}
                    className="accent-deep-lavender"
                  />
                  Tip
                </span>
                <span>{formatChargeMoney(charge.tipAmount)}</span>
              </label>
            </li>
          ) : null}
        </ul>
      ) : null}

      {mode === "amount" ? (
        <label className="mt-6 block">
          <span className="font-body text-xs uppercase tracking-[0.14em] text-taupe">
            Refund amount
          </span>
          <input
            type="number"
            min="0"
            max={remaining}
            step="0.01"
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
            className="mt-2 w-full rounded-xl border border-lavender/40 bg-white px-4 py-3 text-sm"
          />
        </label>
      ) : null}

      <p className="font-body mt-8 text-lg text-ink">
        Refund {formatChargeMoney(amount)}
      </p>
      <button
        type="button"
        disabled={busy || amount <= 0}
        onClick={() => onRefund(amount)}
        className="mt-4 w-full rounded-sm bg-deep-lavender px-6 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ivory disabled:opacity-50"
      >
        {busy ? "Refunding…" : "Confirm refund"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full rounded-sm border border-champagne px-6 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink"
      >
        Back to receipt
      </button>
    </section>
  );
}
