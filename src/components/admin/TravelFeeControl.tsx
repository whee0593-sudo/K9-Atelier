"use client";

import React, { useId } from "react";
import { formatPrice } from "@/lib/business";

export function TravelFeeControl({ automatic, value, onChange, onRestore, disabled = false }: {
  automatic: number;
  value: string | null;
  onChange: (value: string | null) => void;
  onRestore?: () => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="mt-3 space-y-2 rounded-xl border border-lavender/40 p-3">
      <legend className="px-1 text-sm font-medium">Visit travel fee</legend>
      <p className="text-sm">Automatic amount: {formatPrice(automatic)}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value !== null}
          onChange={(event) => onChange(event.target.checked ? String(automatic) : null)} />
        Manually override travel fee
      </label>
      {value !== null ? <>
        <label htmlFor={id} className="block text-sm">Custom amount ($)</label>
        <input id={id} type="number" min="0" max="5000" step="0.01" required value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-lavender/40 px-3 py-2" />
        <p className="text-sm" role="status">Manual override active · $0 waives this fee.</p>
        <button type="button" className="text-sm underline" onClick={() => onRestore ? onRestore() : onChange(null)}>Restore automatic calculation</button>
      </> : <p className="text-sm" role="status">Automatic calculation active</p>}
      <p className="text-xs text-text-muted">Charged once per visit, regardless of the number of dogs.</p>
    </fieldset>
  );
}
