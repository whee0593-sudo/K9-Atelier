"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  formatVisitClock,
  formatVisitDuration,
  formatVisitTimeRange,
} from "@/lib/charges/hourly";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import type { CollectContext } from "@/lib/charges/types";
import { formatServiceAddress } from "@/lib/travel";

export function VisitCheckIn({
  appointmentId,
  preview = false,
}: {
  appointmentId: string;
  preview?: boolean;
}) {
  const [context, setContext] = useState<CollectContext | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (preview) {
      const body = buildPreviewCollectContext();
      setContext(body);
      setStartedAt(body.appointment.serviceStartedAt);
      setEndedAt(body.appointment.serviceEndedAt);
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
      setStartedAt(body.appointment.serviceStartedAt);
      setEndedAt(body.appointment.serviceEndedAt);
    } catch {
      setError("Could not load this appointment.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, preview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, endedAt]);

  async function setTiming(action: "check_in" | "check_out") {
    const stamp = new Date().toISOString();
    if (preview) {
      if (action === "check_in") {
        setStartedAt(stamp);
        setEndedAt(null);
      } else {
        setEndedAt(stamp);
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
          body: JSON.stringify({ action }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        startedAt?: string | null;
        endedAt?: string | null;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not update the visit.");
        return;
      }
      setStartedAt(body.startedAt ?? null);
      setEndedAt(body.endedAt ?? null);
    } catch {
      setError("Could not update the visit.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="font-body text-sm text-taupe">Preparing check-in…</p>;
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
  const timeZone = appointment.timezone;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center text-center">
      {preview ? (
        <p className="mb-6 rounded-xl border border-champagne bg-cream px-4 py-2 text-xs uppercase tracking-[0.16em] text-taupe">
          Preview only · no save
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Arrived
      </p>
      <h1 className="font-display mt-4 text-5xl text-ink">{appointment.petName}</h1>
      <p className="font-body mt-3 text-base text-taupe">
        {appointment.customerName ?? appointment.customerEmail}
      </p>
      <p className="font-body mt-6 text-sm text-ink">{appointment.serviceName}</p>
      <p className="font-body mt-2 text-sm text-taupe">
        {formatServiceAddress({
          street: appointment.addressStreet,
          city: appointment.addressCity,
          state: appointment.addressState,
          zip: appointment.addressZip,
        })}
      </p>
      <p className="font-body mt-1 text-sm text-taupe">
        {appointment.appointmentTime}
      </p>

      <div className="mt-10">
        {!startedAt ? (
          <>
            <p className="font-body text-sm text-taupe">
              Check in when you arrive and start the visit.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setTiming("check_in")}
              className="mt-6 w-full rounded-sm bg-deep-lavender px-6 py-5 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory disabled:opacity-50"
            >
              Check in
            </button>
          </>
        ) : !endedAt ? (
          <>
            <p className="font-display text-3xl text-ink">
              Checked in at {formatVisitClock(startedAt, timeZone)}
            </p>
            <p className="font-body mt-3 text-sm text-taupe">
              In progress · {formatVisitDuration(startedAt, null, now)}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setTiming("check_out")}
              className="mt-8 w-full rounded-sm bg-gold px-6 py-5 text-[12px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-50"
            >
              Check out
            </button>
          </>
        ) : (
          <>
            <p className="font-display text-3xl text-ink">
              {formatVisitTimeRange(startedAt, endedAt, timeZone)}
            </p>
            <p className="font-body mt-3 text-sm text-taupe">
              Visit timed · {formatVisitDuration(startedAt, endedAt)}
            </p>
            <Link
              href={
                preview
                  ? "/admin/collect/preview"
                  : `/admin/collect/${appointmentId}`
              }
              className="mt-8 inline-flex w-full items-center justify-center rounded-sm bg-deep-lavender px-6 py-5 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory"
            >
              Collect payment
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setTiming("check_in")}
              className="mt-4 w-full text-sm text-taupe underline"
            >
              Start again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
