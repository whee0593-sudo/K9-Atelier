"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { formatHourLabel } from "@/lib/appointments/closures";
import { canStaffRescheduleAppointment } from "@/lib/appointments/staff-actions";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";

type AvailabilityDay = {
  date: string;
  available: boolean;
  slots: number[];
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

function previewDays(): AvailabilityDay[] {
  return getUpcomingBookableDates(8).map((day) => ({
    date: day.value,
    available: true,
    slots: listHourlyStartMinutes(),
  }));
}

export function AdminRescheduleAppointmentButton({
  appointment,
  preview = false,
  onChanged,
}: {
  appointment: AdminAppointmentRecord;
  preview?: boolean;
  onChanged?: () => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [nextDate, setNextDate] = useState(appointment.appointmentDate);
  const [nextSlot, setNextSlot] = useState(
    appointment.scheduledStart != null ? String(appointment.scheduledStart) : "",
  );

  const selectedDay = useMemo(
    () => days.find((day) => day.date === nextDate),
    [days, nextDate],
  );
  const minDate = todayInBusinessTimezone();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  useEffect(() => {
    if (!open) return;
    if (preview) {
      setDays(previewDays());
      setLoadingDays(false);
      return;
    }

    let cancelled = false;
    setLoadingDays(true);
    setError(null);
    void fetch(`/api/admin/appointments/${appointment.id}/availability`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          days?: AvailabilityDay[];
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load available times.");
          setDays([]);
          return;
        }
        setDays(body.days ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load available times.");
          setDays([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDays(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointment.id, open, preview]);

  if (!canStaffRescheduleAppointment(appointment)) return null;

  const customerLabel =
    appointment.customerName?.trim() ||
    appointment.customerEmail?.trim() ||
    "Customer";
  const canSave = Boolean(nextDate && nextSlot && !loadingDays);

  async function confirmReschedule() {
    if (!nextDate || !nextSlot) return;

    if (preview) {
      setOpen(false);
      onChanged?.();
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/appointments/${appointment.id}/reschedule`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: nextDate,
            slotStartMinutes: Number(nextSlot),
          }),
        },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Could not change this appointment.");
        return;
      }

      setOpen(false);
      onChanged?.();
    } catch {
      setError("Could not change this appointment.");
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
          setNextDate(appointment.appointmentDate);
          setNextSlot(
            appointment.scheduledStart != null
              ? String(appointment.scheduledStart)
              : "",
          );
          setOpen(true);
        }}
        className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text transition hover:border-gold/40"
      >
        Change date & time
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
            <h3 id={titleId} className="text-lg font-medium text-gold-dark">
              Change date & time
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
                <dt className="text-text-muted">Current</dt>
                <dd>
                  {formatConfirmDate(appointment.appointmentDate)} ·{" "}
                  {appointment.appointmentTime}
                </dd>
              </div>
            </dl>

            <div className="mt-5 grid gap-4">
              <div>
                <label
                  className="block text-sm font-medium text-text"
                  htmlFor={`reschedule-date-${appointment.id}`}
                >
                  New date
                </label>
                <input
                  id={`reschedule-date-${appointment.id}`}
                  type="date"
                  min={minDate}
                  disabled={busy || loadingDays}
                  className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5 text-sm text-text"
                  value={nextDate}
                  onChange={(event) => {
                    setNextDate(event.target.value);
                    setNextSlot("");
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-text"
                  htmlFor={`reschedule-slot-${appointment.id}`}
                >
                  New start time
                </label>
                <select
                  id={`reschedule-slot-${appointment.id}`}
                  disabled={busy || loadingDays || !nextDate}
                  className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5 text-sm text-text"
                  value={nextSlot}
                  onChange={(event) => setNextSlot(event.target.value)}
                >
                  <option value="">
                    {loadingDays ? "Loading times…" : "Select a time"}
                  </option>
                  {(selectedDay?.slots ?? []).map((slot) => (
                    <option key={slot} value={slot}>
                      {formatHourLabel(slot / 60)}
                    </option>
                  ))}
                </select>
                {nextDate && !loadingDays && (selectedDay?.slots.length ?? 0) === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">
                    No open start times on that date. Choose another day.
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              The customer will receive an email with the new date and time. No
              policy fee is charged for a staff change.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || !canSave}
                onClick={() => void confirmReschedule()}
                className="rounded-xl bg-gold px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-cream transition hover:bg-gold-dark disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save new time"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-text transition hover:border-gold/40 disabled:opacity-50"
              >
                Keep current time
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
