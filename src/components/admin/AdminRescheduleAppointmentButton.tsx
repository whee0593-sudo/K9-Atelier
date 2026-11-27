"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatMinutesLabel } from "@/lib/appointments/closures";
import { formatEstimatedDuration } from "@/lib/staff/schedule-conflict";
import { canStaffRescheduleAppointment } from "@/lib/appointments/staff-actions";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { listBookingStartMinutes } from "@/lib/booking-schedule";
import { getUpcomingStaffDates } from "@/lib/staff/booking-dates";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { staffRescheduleServices } from "@/lib/appointments/staff-reschedule-input";
import { AdminAddVisitDog } from "@/components/admin/AdminAddVisitDog";
import { AdminCancelAppointmentButton } from "@/components/admin/AdminCancelAppointmentButton";

type AvailabilityDay = {
  date: string;
  available: boolean;
  slots: number[];
};

type VisitRescheduleSummary = {
  dogCount: number;
  estimatedDurationMinutes: number;
  appointments?: AdminAppointmentRecord[];
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
      slots: unavailable ? [] : listBookingStartMinutes(),
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
    return [...new Set([...(daySlots ?? []), ...listBookingStartMinutes()])].sort((a, b) => a - b);
  }
  if (daySlots && daySlots.length > 0) return daySlots;
  if (hasDate) return listBookingStartMinutes();
  return [];
}

export function AdminRescheduleAppointmentButton({
  appointment,
  preview = false,
  onChanged,
  onDogServiceChanged,
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
  onDogServiceChanged?: (appointment: AdminAppointmentRecord) => void;
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
  const [addingDog, setAddingDog] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const initializedArrival = useRef(false);
  const refreshOnClose = useRef(false);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [dogEdit, setDogEdit] = useState<{ id: string; serviceId: string } | null>(null);
  const [dogError, setDogError] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitRescheduleSummary | null>(() =>
    summaryFromAppointments(visitAppointments),
  );
  const [nextDate, setNextDate] = useState(appointment.appointmentDate);
  const visitRows = visit?.appointments ?? visitAppointments;
  const arrival = visitRows?.reduce((first, row) =>
    (row.scheduledStart ?? Infinity) < (first.scheduledStart ?? Infinity) ? row : first,
    appointment,
  ) ?? appointment;
  const currentSlot = arrival.scheduledStart == null ? "" : String(arrival.scheduledStart);
  const bookedDogs = (visitRows?.length ? visitRows : [appointment])
    .filter((row) => row.status !== "cancelled");
  const visitNotStarted = bookedDogs.every((row) =>
    !row.serviceStartedAt && !row.serviceEndedAt && !row.visitStartedAt && !row.visitEndedAt,
  );
  const canChangeDogs = !preview && Boolean(appointment.visitId) && visitNotStarted;
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
      if (event.key === "Escape" && !busy && !addingDog) {
        setOpen(false);
        if (refreshOnClose.current) onChanged?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, addingDog, onChanged]);

  useEffect(() => {
    if (!open) return;
    if (preview) {
      const listed = previewDays(unavailableDates);
      if (
        appointment.appointmentDate &&
        !listed.some((day) => day.date === appointment.appointmentDate)
      ) {
        const slots = listBookingStartMinutes();
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
    void fetch(`/api/admin/appointments/${appointment.id}/availability`, {
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
    availabilityRevision,
    open,
    preview,
    unavailableDates,
  ]);

  useEffect(() => {
    if (!open || initializedArrival.current || !visit?.appointments?.length) return;
    initializedArrival.current = true;
    setNextDate(arrival.appointmentDate);
    setNextSlot(currentSlot);
  }, [arrival.appointmentDate, currentSlot, open, visit?.appointments]);

  if (!canStaffRescheduleAppointment(appointment)) return null;

  const customerLabel =
    appointment.customerName?.trim() ||
    appointment.customerEmail?.trim() ||
    "Customer";
  const canSave = timeChanged && Boolean(
    nextDate && nextSlot && !loadingDays && (!limitToOpenSlots || slotChoices.includes(Number(nextSlot))),
  );

  function closeDialog() {
    if (busy || addingDog) return;
    setOpen(false);
    if (refreshOnClose.current) onChanged?.();
  }

  async function saveChange(
    id: string,
    change: { serviceId: string } | { date: string; slotStartMinutes: number },
  ) {
    const submit = (acknowledgedConflict?: string) => fetch(
      `/api/admin/appointments/${id}/reschedule`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...change, acknowledgedConflict }),
      },
    );
    let response = await submit();
    let body = (await response.json()) as { error?: string; code?: string; appointment?: AdminAppointmentRecord };
    while (response.status === 409 && body.code === "schedule_conflict" && body.error) {
      if (!window.confirm(`${body.error}\n\nSave this change anyway?`)) return null;
      response = await submit(body.error);
      body = await response.json();
    }
    if (!response.ok) throw new Error(body.error ?? "Could not change this appointment.");
    return body;
  }

  async function saveDogService(dog: AdminAppointmentRecord) {
    if (!dogEdit || dogEdit.id !== dog.id || busy || addingDog) return;
    const { serviceId } = dogEdit;
    if (serviceId === dog.serviceId) {
      setDogEdit(null);
      return;
    }
    setBusy(true);
    setDogError(null);
    try {
      const body = preview ? null : await saveChange(dog.id, { serviceId });
      if (!preview && !body) return;
      const service = staffRescheduleServices(dog.petWeightLbs).find((item) => item.id === serviceId);
      const updated = body?.appointment ?? { ...dog, serviceId, serviceName: service?.name ?? dog.serviceName };
      const appointments = bookedDogs.map((row) => row.id === dog.id ? updated : row);
      setVisit({ ...summaryFromAppointments(appointments)!, appointments });
      setDogEdit(null);
      if (onDogServiceChanged) onDogServiceChanged(updated);
      else if (!preview) refreshOnClose.current = true;
      if (!preview) setAvailabilityRevision((revision) => revision + 1);
    } catch (failure) {
      setDogError(failure instanceof Error ? failure.message : "Could not update this dog's service.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReschedule() {
    if (!canSave || busy || dogEdit) return;

    if (preview) {
      setOpen(false);
      onChanged?.({
        date: nextDate,
        slotStartMinutes: Number(nextSlot),
      });
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const body = await saveChange(appointment.id, { date: nextDate, slotStartMinutes: Number(nextSlot) });
      if (!body) return;

      setOpen(false);
      onChanged?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not change this appointment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          initializedArrival.current = Boolean(visitAppointments?.length);
          setError(null);
          setAvailabilityError(null);
          setDogEdit(null);
          setDogError(null);
          refreshOnClose.current = false;
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
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={
              limitToOpenSlots
                ? "max-h-[90dvh] min-h-0 w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-lavender/30 bg-cream p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-sm sm:rounded-2xl"
                : "max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-lavender/30 bg-cream p-6 shadow-sm"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id={titleId} className="text-lg font-medium text-gold-dark">
                {dialogTitle}
              </h3>
              <button
                type="button"
                aria-label="Close reschedule dialog"
                disabled={busy || addingDog}
                onClick={closeDialog}
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
                <dt className="text-text-muted">{bookedDogs.length === 1 ? "Dog" : "Dogs on this visit"}</dt>
                <dd>
                  <ul className="divide-y divide-lavender/40">
                    {bookedDogs.map((dog) => {
                      const editing = dogEdit?.id === dog.id ? dogEdit : null;
                      const services = staffRescheduleServices(dog.petWeightLbs);
                      const canEdit = visitNotStarted && canStaffRescheduleAppointment(dog);
                      return (
                        <li key={dog.id} className="py-2">
                          <div className="flex items-center gap-2">
                            {editing && canChangeDogs && bookedDogs.length > 1 ? (
                              <AdminCancelAppointmentButton
                                appointment={dog}
                                label="×"
                                triggerAriaLabel={`Remove ${dog.petName}`}
                                triggerDisabled={busy || addingDog}
                                triggerClassName="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-xl leading-none text-red-700 hover:bg-red-50 disabled:opacity-50"
                                confirmTitle={`Remove ${dog.petName} from this visit?`}
                                showService
                                sheetOnMobile
                                removeDogOnly
                                onCancelled={() => {
                                  setOpen(false);
                                  onChanged?.();
                                }}
                              />
                            ) : null}
                            <span className="max-w-[35%] shrink-0 break-words font-medium">{dog.petName}</span>
                            {editing ? (
                              <select
                                aria-label={`Service for ${dog.petName}`}
                                value={editing.serviceId}
                                disabled={busy || addingDog || services.length === 0}
                                onChange={(event) => {
                                  setDogEdit({ id: dog.id, serviceId: event.target.value });
                                  setDogError(null);
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-lavender/40 bg-white px-2 py-2 text-sm"
                              >
                                <option value={dog.serviceId}>{dog.serviceName}</option>
                                {services.filter((service) => service.id !== dog.serviceId).map((service) => (
                                  <option key={service.id} value={service.id}>{service.name}</option>
                                ))}
                              </select>
                            ) : <span className="min-w-0 flex-1 break-words">{dog.serviceName}</span>}
                            {canEdit ? (
                              <button
                                type="button"
                                aria-label={`${editing ? "Save" : "Edit"} ${dog.petName}'s service`}
                                disabled={busy || addingDog || (!editing && Boolean(dogEdit))}
                                className="shrink-0 rounded-lg border border-lavender/40 px-2.5 py-1.5 font-medium text-gold-dark hover:bg-lavender/20 disabled:opacity-50"
                                onClick={() => {
                                  if (editing) {
                                    void saveDogService(dog);
                                  } else {
                                    setDogError(null);
                                    setDogEdit({ id: dog.id, serviceId: dog.serviceId });
                                  }
                                }}
                              >
                                {editing ? (busy ? "Saving…" : "Save") : "Edit"}
                              </button>
                            ) : null}
                          </div>
                          {editing && services.length === 0 ? (
                            <p className="mt-2 text-text-muted">Add this dog's weight to their profile to see available services.</p>
                          ) : null}
                          {editing && dogError ? <p className="mt-2 text-red-700" role="alert">{dogError}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                  {canChangeDogs && (!busy || addingDog) && !timeChanged && !dogEdit ? (
                    <AdminAddVisitDog appointment={appointment} booked={bookedDogs} onSaving={setAddingDog} onSaved={() => {
                      setOpen(false);
                      onChanged?.();
                    }} />
                  ) : null}
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
                  disabled={busy || addingDog || loadingDays || Boolean(dogEdit)}
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
                  disabled={busy || addingDog || loadingDays || !nextDate || Boolean(dogEdit)}
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
                  ? "Changing the arrival moves every dog on this visit and sends the customer one email."
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
                disabled={busy || addingDog || !canSave || Boolean(dogEdit)}
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
