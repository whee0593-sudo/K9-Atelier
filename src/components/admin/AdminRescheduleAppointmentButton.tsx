"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { formatMinutesLabel } from "@/lib/appointments/closures";
import { formatEstimatedDuration } from "@/lib/staff/schedule-conflict";
import { canStaffRescheduleAppointment } from "@/lib/appointments/staff-actions";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import { getUpcomingStaffDates } from "@/lib/staff/booking-dates";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { staffRescheduleServices } from "@/lib/appointments/staff-reschedule-input";

type AvailabilityDay = {
  date: string;
  available: boolean;
  slots: number[];
};

type VisitRescheduleSummary = {
  dogCount: number;
  estimatedDurationMinutes: number;
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

function summaryFromAppointments(
  rows: AdminAppointmentRecord[] | undefined,
): VisitRescheduleSummary | null {
  if (!rows || rows.length === 0) return null;
  return {
    dogCount: rows.length,
    estimatedDurationMinutes: rows.reduce(
      (sum, row) => sum + (row.estimatedDurationMinutes ?? 0),
      0,
    ),
  };
}

function previewDays(unavailableDates?: readonly string[]): AvailabilityDay[] {
  const closed = new Set(unavailableDates ?? []);
  return getUpcomingStaffDates(8).map((day) => {
    const unavailable = closed.has(day.value);
    return {
      date: day.value,
      available: !unavailable,
      slots: unavailable ? [] : listHourlyStartMinutes(),
    };
  });
}

/** Include hourly starts so an owner can review conflicts before saving. */
export function staffRescheduleSlotChoices(
  daySlots: number[] | undefined,
  hasDate: boolean,
  limitToOpenSlots: boolean,
) {
  if (limitToOpenSlots && hasDate) {
    return [...new Set([...(daySlots ?? []), ...listHourlyStartMinutes()])].sort((a, b) => a - b);
  }
  if (daySlots && daySlots.length > 0) return daySlots;
  if (hasDate) return listHourlyStartMinutes();
  return [];
}

export function AdminRescheduleAppointmentButton({
  appointment,
  preview = false,
  onChanged,
  label = "Change date & time",
  dialogTitle = "Change date & time",
  triggerClassName = "rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text transition hover:border-gold/40",
  limitToOpenSlots = false,
  unavailableDates,
  visitAppointments,
}: {
  appointment: AdminAppointmentRecord;
  preview?: boolean;
  onChanged?: (next?: { date: string; slotStartMinutes: number; serviceId?: string; serviceName?: string }) => void;
  label?: string;
  dialogTitle?: string;
  triggerClassName?: string;
  /** When true, the arrival list is only the slots the server marked open. */
  limitToOpenSlots?: boolean;
  /** Preview-only dates that already have an all-day block. Live saves recheck on the server. */
  unavailableDates?: string[];
  visitAppointments?: AdminAppointmentRecord[];
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [visit, setVisit] = useState<VisitRescheduleSummary | null>(() =>
    summaryFromAppointments(visitAppointments),
  );
  const [nextDate, setNextDate] = useState(appointment.appointmentDate);
  const arrival = visitAppointments?.reduce((first, row) =>
    (row.scheduledStart ?? Infinity) < (first.scheduledStart ?? Infinity) ? row : first,
    appointment,
  ) ?? appointment;
  const currentSlot = arrival.scheduledStart == null ? "" : String(arrival.scheduledStart);
  const [serviceId, setServiceId] = useState(appointment.serviceId);
  const serviceChanged = serviceId !== appointment.serviceId;
  const services = staffRescheduleServices(appointment.petWeightLbs);
  const canEditService = !appointment.serviceStartedAt && !appointment.serviceEndedAt &&
    !appointment.visitStartedAt && !appointment.visitEndedAt;
  const [nextSlot, setNextSlot] = useState(
    appointment.scheduledStart != null ? String(appointment.scheduledStart) : "",
  );

  const selectedDay = useMemo(
    () => days.find((day) => day.date === nextDate),
    [days, nextDate],
  );
  const slotChoices = useMemo(
    () =>
      staffRescheduleSlotChoices(
        selectedDay?.slots,
        Boolean(nextDate),
        limitToOpenSlots,
      ),
    [limitToOpenSlots, nextDate, selectedDay],
  );
  const minDate = todayInBusinessTimezone();
  const timeChanged = nextDate !== arrival.appointmentDate || nextSlot !== currentSlot;
  const showCurrentSlot = nextDate === arrival.appointmentDate &&
    arrival.scheduledStart != null && !slotChoices.includes(arrival.scheduledStart);

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
      const listed = previewDays(unavailableDates);
      if (
        appointment.appointmentDate &&
        !listed.some((day) => day.date === appointment.appointmentDate)
      ) {
        const slots = listHourlyStartMinutes();
        if (
          appointment.scheduledStart != null &&
          !slots.includes(appointment.scheduledStart)
        ) {
          slots.push(appointment.scheduledStart);
          slots.sort((left, right) => left - right);
        }
        listed.unshift({
          date: appointment.appointmentDate,
          available: true,
          slots,
        });
      }
      setDays(listed);
      setLoadingDays(false);
      return;
    }

    let cancelled = false;
    setLoadingDays(true);
    setAvailabilityError(null);
    const query = serviceChanged ? `?serviceId=${encodeURIComponent(serviceId)}` : "";
    void fetch(`/api/admin/appointments/${appointment.id}/availability${query}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          days?: AvailabilityDay[];
          visit?: VisitRescheduleSummary;
        };
        if (cancelled) return;
        if (!response.ok) {
          setAvailabilityError(body.error ?? "Could not load available times.");
          setDays([]);
          return;
        }
        setDays(body.days ?? []);
        setVisit(body.visit ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setAvailabilityError("Could not load available times.");
          setDays([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDays(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    appointment.appointmentDate,
    appointment.id,
    appointment.scheduledStart,
    open,
    preview,
    serviceChanged,
    serviceId,
    unavailableDates,
  ]);

  if (!canStaffRescheduleAppointment(appointment)) return null;

  const customerLabel =
    appointment.customerName?.trim() ||
    appointment.customerEmail?.trim() ||
    "Customer";
  const canSave = timeChanged
    ? Boolean(nextDate && nextSlot && !loadingDays && (!limitToOpenSlots || slotChoices.includes(Number(nextSlot))))
    : serviceChanged;

  async function confirmReschedule() {
    if (!canSave || busy) return;

    if (preview) {
      setOpen(false);
      onChanged?.({
        date: nextDate,
        slotStartMinutes: Number(nextSlot),
        ...(serviceChanged ? { serviceId, serviceName: services.find((service) => service.id === serviceId)?.name } : {}),
      });
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const submit = (acknowledgedConflict?: string) => fetch(
        `/api/admin/appointments/${appointment.id}/reschedule`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(timeChanged ? { date: nextDate, slotStartMinutes: Number(nextSlot) } : {}),
            ...(serviceChanged ? { serviceId } : {}),
            acknowledgedConflict,
          }),
        },
      );
      let response = await submit();
      let body = (await response.json()) as { error?: string; code?: string };
      while (response.status === 409 && body.code === "schedule_conflict" && body.error) {
        if (!window.confirm(`${body.error}\n\nSave this change anyway?`)) return;
        response = await submit(body.error);
        body = await response.json();
      }

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
          setAvailabilityError(null);
          setServiceId(appointment.serviceId);
          setVisit(summaryFromAppointments(visitAppointments));
          setDays([]);
          setNextDate(arrival.appointmentDate);
          setNextSlot(currentSlot);
          setOpen(true);
        }}
        data-appointment-action="reschedule"
        className={triggerClassName}
      >
        {label}
      </button>

      {open ? (
        <div
          className={
            limitToOpenSlots
              ? "fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
              : "fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 p-4"
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
              limitToOpenSlots
                ? "max-h-[90dvh] min-h-0 w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-lavender/30 bg-cream p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-sm sm:rounded-2xl"
                : "w-full max-w-md rounded-2xl border border-lavender/30 bg-cream p-6 shadow-sm"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id={titleId} className="text-lg font-medium text-gold-dark">
                {dialogTitle}
              </h3>
              <button
                type="button"
                aria-label="Close without saving"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="-mr-2 -mt-2 rounded-lg px-3 py-1 text-2xl leading-none text-text-muted hover:bg-lavender/20 disabled:opacity-50"
              >
                ×
              </button>
            </div>
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
                <dt className="text-text-muted">
                  <label htmlFor={`${titleId}-service`}>Service</label>
                </dt>
                <dd>
                  <select
                    id={`${titleId}-service`}
                    value={serviceId}
                    disabled={busy || !canEditService || services.length === 0}
                    onChange={(event) => {
                      setServiceId(event.target.value);
                      setDays([]);
                      setLoadingDays(!preview);
                      setError(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5 text-sm text-text"
                  >
                    <option value={appointment.serviceId}>{appointment.serviceName}</option>
                    {services.filter((service) => service.id !== appointment.serviceId).map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </dd>
              </div>
              {visit && visit.estimatedDurationMinutes > 0 ? (
                <div>
                  <dt className="text-text-muted">Estimated duration</dt>
                  <dd>{formatEstimatedDuration(visit.estimatedDurationMinutes)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-text-muted">Current</dt>
                <dd>
                  {formatConfirmDate(arrival.appointmentDate)} ·{" "}
                  {arrival.appointmentTime}
                </dd>
              </div>
            </dl>

            <div className="mt-5 grid gap-4">
              <div>
                <label
                  className="block text-sm font-medium text-text"
                  htmlFor={`reschedule-date-${appointment.id}`}
                >
                  {limitToOpenSlots ? "Date" : "New date"}
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
                    setNextSlot(event.target.value === arrival.appointmentDate ? currentSlot : "");
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-text"
                  htmlFor={`reschedule-slot-${appointment.id}`}
                >
                  Arrival
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
                  {showCurrentSlot ? (
                    <option value={currentSlot}>{formatMinutesLabel(Number(currentSlot))}</option>
                  ) : null}
                  {slotChoices.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatMinutesLabel(slot)}
                    </option>
                  ))}
                </select>
                {nextDate && !loadingDays && !showCurrentSlot && slotChoices.length === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">
                    No open start times on that date. Choose another day.
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {appointment.serviceStartedAt || appointment.serviceEndedAt
                ? "This only corrects the calendar date and arrival. Check-in, check-out, and payment stay on the record. The customer will not be emailed."
                : visit && visit.dogCount > 1
                  ? "Changing the arrival moves every dog on this visit and sends the customer one email. The service selection applies to the pet shown above."
                  : "If the date or arrival changes, the customer receives an email. No policy fee is charged for a staff change."}
            </p>
            {error || availabilityError ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error ?? availabilityError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || !canSave}
                onClick={() => void confirmReschedule()}
                className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save the change"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
