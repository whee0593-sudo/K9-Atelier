"use client";

import { useState } from "react";

type Props = {
  appointmentId?: string;
  customerId?: string;
  phone?: string;
  label?: string;
  disabled?: boolean;
  preview?: boolean;
};

export function CallCustomerButton({
  appointmentId,
  customerId,
  phone,
  label = "Call customer",
  disabled = false,
  preview = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startCall() {
    if (preview) {
      setMessage("Preview only — no call is placed.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/voice/call", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, customerId, phone }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Could not start the call.");
        return;
      }
      setMessage("Calling your phone now. Answer to connect the customer.");
    } catch {
      setMessage("Could not start the call.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled || busy || (!appointmentId && !customerId && !phone)}
        onClick={() => void startCall()}
        className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text transition hover:border-gold/40 disabled:opacity-50"
      >
        {busy ? "Calling…" : label}
      </button>
      {message ? (
        <span className="max-w-xs text-xs text-text-muted">{message}</span>
      ) : null}
    </span>
  );
}
