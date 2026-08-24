"use client";

import { useEffect, useState } from "react";
import {
  formatVisitDuration,
  formatVisitTimeRange,
  hourlyAmountFromTimes,
} from "@/lib/charges/hourly";
import { formatChargeMoney } from "@/lib/charges/money";
import { CheckoutTextToggle } from "@/components/admin/CheckoutTextToggle";

export function HourlyVisitTimer({
  appointmentId,
  preview,
  rate,
  startedAt,
  endedAt,
  timeZone,
  onTimesChange,
}: {
  appointmentId: string;
  preview: boolean;
  rate: number;
  startedAt: string | null;
  endedAt: string | null;
  timeZone?: string;
  onTimesChange: (next: {
    startedAt: string | null;
    endedAt: string | null;
  }) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendCheckoutText, setSendCheckoutText] = useState(true);

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, endedAt]);

  async function setTiming(action: "check_in" | "check_out") {
    const stamp = new Date().toISOString();
    if (preview) {
      if (action === "check_in") {
        onTimesChange({ startedAt: stamp, endedAt: null });
      } else {
        onTimesChange({ startedAt: startedAt ?? stamp, endedAt: stamp });
      }
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/appointments/${appointmentId}/timing`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            sendCheckoutText: action === "check_out" ? sendCheckoutText : undefined,
          }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        startedAt?: string | null;
        endedAt?: string | null;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not update the timer.");
        return;
      }
      onTimesChange({
        startedAt: body.startedAt ?? null,
        endedAt: body.endedAt ?? null,
      });
    } catch {
      setError("Could not update the timer.");
    } finally {
      setBusy(false);
    }
  }

  const amount =
    startedAt != null
      ? hourlyAmountFromTimes(startedAt, endedAt, rate, now)
      : 0;

  return (
    <div className="mt-3">
      <p className="font-body text-xs text-taupe">Time</p>
      <p className="mt-1 text-sm text-ink">
        {formatVisitTimeRange(startedAt, endedAt, timeZone)}
      </p>
      {startedAt ? (
        <p className="mt-1 text-xs text-taupe">
          {endedAt ? "Timed" : "In progress"} ·{" "}
          {formatVisitDuration(startedAt, endedAt, now)} ·{" "}
          {formatChargeMoney(rate)}/hr
          {startedAt ? ` · ${formatChargeMoney(amount)}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-xs text-taupe">
          Check in when you start. {formatChargeMoney(rate)}/hr
        </p>
      )}
      <div className="mt-3 flex flex-col items-start gap-3">
        {!startedAt || endedAt ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void setTiming("check_in")}
            className="rounded-xl bg-deep-lavender px-4 py-2 text-sm font-medium text-ivory disabled:opacity-50"
          >
            {endedAt ? "Start again" : "Check in"}
          </button>
        ) : (
          <>
            <CheckoutTextToggle
              checked={sendCheckoutText}
              onChange={setSendCheckoutText}
              disabled={busy}
              className="justify-start"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void setTiming("check_out")}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Check out
            </button>
          </>
        )}
      </div>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
