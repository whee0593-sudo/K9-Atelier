"use client";

import { useEffect, useId, useState } from "react";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

function formatConfirmDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminCancelAppointmentButton({
  appointment,
  preview = false,
  onCancelled,
}: {
  appointment: AdminAppointmentRecord;
  preview?: boolean;
  onCancelled?: () => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  if (appointment.status !== "confirmed") return null;

  const customerLabel =
    appointment.customerName?.trim() ||
    appointment.customerEmail?.trim() ||
    "Customer";

  async function confirmCancel() {
    if (preview) {
      setOpen(false);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/appointments/${appointment.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Could not cancel this appointment.");
        return;
      }

      setOpen(false);
      onCancelled?.();
    } catch {
      setError("Could not cancel this appointment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={preview}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        Cancel Appointment
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="presentation"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-2xl border border-lavender/30 bg-cream p-6 shadow-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={titleId}
              className="text-lg font-medium text-gold-dark"
            >
              Cancel this appointment?
            </h3>
            <dl className="mt-4 space-y-2 text-sm text-text">
              <div>
                <dt className="text-text-muted">Customer</dt>
                <dd>{customerLabel}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Pet</dt>
                <dd>{appointment.petName}</dd>
              </div>
              <div>
                <dt className="text-text-muted">When</dt>
                <dd>
                  {formatConfirmDate(appointment.appointmentDate)} ·{" "}
                  {appointment.appointmentTime}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              The customer will receive an email and text that this confirmed
              appointment has been cancelled.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmCancel()}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                {busy ? "Cancelling…" : "Cancel Appointment"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-text transition hover:border-gold/40 disabled:opacity-50"
              >
                Keep Appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
