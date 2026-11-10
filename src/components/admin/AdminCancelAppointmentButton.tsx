"use client";

import React, { useEffect, useId, useState } from "react";
import { canStaffCancelAppointment } from "@/lib/appointments/staff-actions";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

type CancellationQuote = {
  fee: number;
  locked: boolean;
  needsPriceReview: boolean;
  hasPaymentMethod: boolean;
  hasEmail: boolean;
};

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
  label = "Cancel Appointment",
  confirmTitle = "Cancel this appointment?",
  triggerClassName = "rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50",
  showService = false,
  showReason = false,
  defaultOpen = false,
  sheetOnMobile = false,
}: {
  appointment: AdminAppointmentRecord;
  preview?: boolean;
  onCancelled?: () => void;
  label?: string;
  confirmTitle?: string;
  triggerClassName?: string;
  showService?: boolean;
  showReason?: boolean;
  defaultOpen?: boolean;
  sheetOnMobile?: boolean;
}) {
  const titleId = useId();
  const reasonId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  useEffect(() => {
    if (!open || preview) return;
    const controller = new AbortController();
    setQuote(null);
    setError(null);
    async function loadQuote() {
      try {
        const response = await fetch(`/api/admin/appointments/${appointment.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load the cancellation fee.");
          return;
        }
        setQuote(body);
        setAmount(body.fee.toFixed(2));
      } catch {
        if (!controller.signal.aborted) setError("Could not load the cancellation fee.");
      }
    }
    void loadQuote();
    return () => controller.abort();
  }, [appointment.id, open, preview]);

  if (!canStaffCancelAppointment(appointment)) return null;

  const enteredFee = Number(amount);
  const canConfirm = preview || (quote && !quote.needsPriceReview && amount.trim() &&
    enteredFee >= 0 && enteredFee <= quote.fee &&
    (enteredFee === 0 || (enteredFee >= 0.5 && quote.hasPaymentMethod)));

  const customerLabel =
    appointment.customerName?.trim() ||
    appointment.customerEmail?.trim() ||
    "Customer";

  async function confirmCancel() {
    if (preview) {
      setOpen(false);
      onCancelled?.();
      return;
    }

    if (!canConfirm || busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/appointments/${appointment.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "cancelled",
            expectedPolicyFee: quote?.fee,
            amount: enteredFee,
          }),
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
        onClick={() => {
          setError(null);
          setQuote(null);
          setOpen(true);
        }}
        data-appointment-action="cancel"
        className={triggerClassName}
      >
        {label}
      </button>

      {open ? (
        <div
          className={
            sheetOnMobile
              ? "fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
              : "fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          }
          role="presentation"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={
              sheetOnMobile
                ? "max-h-[90dvh] min-h-0 w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-lavender/30 bg-cream p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-sm sm:rounded-2xl"
                : "w-full max-w-md rounded-2xl border border-lavender/30 bg-cream p-6 shadow-sm"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={titleId}
              className="text-lg font-medium text-gold-dark"
            >
              {confirmTitle}
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
              {showService ? (
                <>
                  <div>
                    <dt className="text-text-muted">Date</dt>
                    <dd>{formatConfirmDate(appointment.appointmentDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Service</dt>
                    <dd>{appointment.serviceName}</dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt className="text-text-muted">When</dt>
                  <dd>
                    {formatConfirmDate(appointment.appointmentDate)} ·{" "}
                    {appointment.appointmentTime}
                  </dd>
                </div>
              )}
            </dl>
            {!preview && !quote && !error ? (
              <p className="mt-4 text-sm" role="status">Checking cancellation fee…</p>
            ) : null}
            {quote?.needsPriceReview ? (
              <p className="mt-4 text-sm text-red-700" role="alert">
                Review the saved visit price or prior policy charges before cancelling.
              </p>
            ) : quote && quote.fee > 0 ? (
              <div className="mt-4 space-y-2 text-sm">
                <label className="block">
                  Cancellation fee (USD)
                  <input
                    className="mt-1 block w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5"
                    type="number"
                    min={0}
                    max={quote.fee}
                    step="0.01"
                    value={amount}
                    readOnly={quote.locked}
                    disabled={busy}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                {quote.locked ? (
                  <p>This fee is locked while the existing payment is checked.</p>
                ) : (
                  <p>Policy fee: ${quote.fee.toFixed(2)}. Enter $0 to waive it.</p>
                )}
                {enteredFee > 0 && !quote.hasPaymentMethod ? (
                  <p role="alert">No saved payment method. Add one or waive the fee to cancel.</p>
                ) : enteredFee > 0 && !quote.hasEmail ? (
                  <p role="status">There is no email on file for the payment receipt.</p>
                ) : enteredFee > 0 && !quote.locked ? (
                  <p>The saved card will be charged and Stripe will email the receipt.</p>
                ) : null}
              </div>
            ) : quote ? (
              <p className="mt-4 text-sm">No cancellation fee applies.</p>
            ) : null}
            {showReason ? (
              <div className="mt-4">
                <label
                  htmlFor={reasonId}
                  className="block text-sm font-medium text-text"
                >
                  Cancellation reason
                  <span className="font-normal text-text-muted"> (optional)</span>
                </label>
                <textarea
                  id={reasonId}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  disabled={busy}
                  className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5 text-sm text-text"
                />
              </div>
            ) : null}
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {appointment.status === "confirmed"
                ? "The customer will receive an email and text that this confirmed appointment has been cancelled."
                : "The customer will be notified that this booking request was cancelled."}
            </p>
            {error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || !canConfirm}
                onClick={() => void confirmCancel()}
                className={`rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-red-700 transition hover:bg-red-100 disabled:opacity-50 ${sheetOnMobile ? "min-h-11" : ""}`}
              >
                {busy ? "Cancelling…" : "Cancel Appointment"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className={`rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-text transition hover:border-gold/40 disabled:opacity-50 ${sheetOnMobile ? "min-h-11" : ""}`}
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
