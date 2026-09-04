"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppointmentActionLinks } from "@/components/admin/AppointmentActionLinks";
import { AppointmentCornerMark } from "@/components/admin/AppointmentCornerMark";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import {
  PREVIEW_CALENDAR_MONTH,
  buildPreviewCalendarAppointments,
  buildPreviewCalendarMonth,
  buildPreviewPaidKinds,
} from "@/lib/appointments/calendar-preview";
import type { ChargeKind } from "@/lib/charges/types";
import { formatPrice } from "@/lib/business";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import { formatServiceAddress } from "@/lib/travel";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(month: string) {
  const [year, monthText] = month.split("-").map(Number);
  return new Date(year, monthText - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(month: string, delta: number) {
  const [year, monthText] = month.split("-").map(Number);
  const next = new Date(year, monthText - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(status: AdminAppointmentRecord["status"]) {
  if (status === "pending_confirmation") return "Pending Review";
  if (status === "cancelled") return "Cancelled";
  return "Confirmed";
}

export function AdminCalendar({
  preview = false,
  onAppointmentsChanged,
  reloadToken = 0,
}: {
  preview?: boolean;
  /** Fired after an operational change (for example cancelling a confirmed visit). */
  onAppointmentsChanged?: () => void;
  /** Bump to reload the month grid (for example after closing a day). */
  reloadToken?: number;
}) {
  const [month, setMonth] = useState(() =>
    preview
      ? PREVIEW_CALENDAR_MONTH
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(new Date())
          .slice(0, 7),
  );
  const [days, setDays] = useState<AdminCalendarDay[]>([]);
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AdminAppointmentRecord[]>([]);
  const [paidKinds, setPaidKinds] = useState<Record<string, ChargeKind[]>>({});
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayVersion, setDayVersion] = useState(0);

  const loadMonth = useCallback(async (nextMonth: string) => {
    setLoadingMonth(true);
    setError(null);
    if (preview) {
      const body = buildPreviewCalendarMonth(nextMonth);
      setDays(body.days);
      setToday(body.today);
      setSelectedDate((current) => {
        if (current?.startsWith(nextMonth)) return current;
        return body.today.startsWith(nextMonth)
          ? body.today
          : (body.days.find((day) => day.appointmentCount > 0)?.date ??
              body.days[0]?.date ??
              null);
      });
      setLoadingMonth(false);
      return;
    }
    try {
      const response = await fetch(`/api/admin/calendar?month=${nextMonth}`, {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        today?: string;
        days?: AdminCalendarDay[];
      };
      if (!response.ok) {
        setError(body.error ?? "Could not load the calendar.");
        return;
      }
      setDays(body.days ?? []);
      setToday(body.today ?? "");
      setSelectedDate((current) => {
        if (current?.startsWith(nextMonth)) return current;
        return body.today?.startsWith(nextMonth) ? body.today : (body.days?.[0]?.date ?? null);
      });
    } catch {
      setError("Could not load the calendar.");
    } finally {
      setLoadingMonth(false);
    }
  }, [preview]);

  useEffect(() => {
    void loadMonth(month);
  }, [loadMonth, month, reloadToken]);

  useEffect(() => {
    if (!selectedDate) return;
    if (preview) {
      const previewAppointments = buildPreviewCalendarAppointments(selectedDate);
      setAppointments(previewAppointments);
      setPaidKinds(buildPreviewPaidKinds(previewAppointments));
      setLoadingDay(false);
      return;
    }
    let cancelled = false;
    setLoadingDay(true);
    void fetch(`/api/admin/appointments?date=${selectedDate}`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          appointments?: AdminAppointmentRecord[];
          paidKinds?: Record<string, ChargeKind[]>;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load that day.");
          return;
        }
        setAppointments(body.appointments ?? []);
        setPaidKinds(body.paidKinds ?? {});
      })
      .catch(() => {
        if (!cancelled) setError("Could not load that day.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, selectedDate, dayVersion]);

  function refreshSelectedDay() {
    setDayVersion((current) => current + 1);
    void loadMonth(month);
    onAppointmentsChanged?.();
  }

  const leadingBlanks = useMemo(() => {
    if (days.length === 0) return 0;
    return new Date(`${days[0].date}T12:00:00`).getDay();
  }, [days]);

  return (
    <section id="calendar">
      <h3 className="text-lg font-medium text-gold-dark">Calendar</h3>
      <p className="mt-1 text-sm text-text-muted">
        Gray days are in the past or fully booked. White days still have room.
        Click a day to see every booking.
      </p>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
          className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text"
        >
          Previous
        </button>
        <p className="text-sm font-medium text-gold-dark">{monthLabel(month)}</p>
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
          className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text"
        >
          Next
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-lavender/30 bg-cream">
        <div className="grid grid-cols-7 border-b border-lavender/20 bg-lavender-light/40 text-center text-xs font-medium uppercase tracking-wide text-text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2">
              {day}
            </div>
          ))}
        </div>
        {loadingMonth ? (
          <p className="px-4 py-8 text-sm text-text-muted">Loading calendar…</p>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} className="min-h-16 bg-lavender-light/20" />
            ))}
            {days.map((day) => {
              const muted =
                day.isPast ||
                day.isFull ||
                Boolean(day.closure?.closedAllDay) ||
                Boolean(day.closure?.closedHours.length);
              const selected = selectedDate === day.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={`min-h-16 border-t border-l border-lavender/15 px-1.5 py-2 text-left ${
                    muted ? "bg-lavender-light/70 text-text-muted" : "bg-white text-text"
                  } ${selected ? "ring-2 ring-inset ring-gold" : ""}`}
                >
                  <span
                    className={`text-sm ${
                      day.isToday ? "font-semibold text-gold-dark" : ""
                    }`}
                  >
                    {Number(day.date.slice(-2))}
                  </span>
                  {day.closureLabel ? (
                    <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-gold-dark">
                      {day.closureLabel}
                    </span>
                  ) : null}
                  {day.appointmentCount > 0 ? (
                    <span className="mt-1 block text-[11px]">
                      {day.appointmentCount} booked
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h4 className="text-base font-medium text-gold-dark">
          {selectedDate ? formatLongDate(selectedDate) : "Select a day"}
        </h4>
        {selectedDate === today ? (
          <p className="mt-1 text-xs text-text-muted">Today</p>
        ) : null}
        {loadingDay ? (
          <p className="mt-4 text-sm text-text-muted">Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-lavender/30 bg-cream p-6 text-sm text-text-muted">
            No appointments on this day.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="rounded-2xl border border-lavender/30 bg-cream p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gold-dark">
                      {appointment.petName}
                      {appointment.petBreed ? (
                        <span className="font-normal text-text-muted">
                          {" "}
                          · {appointment.petBreed}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {appointment.customerName ?? appointment.customerEmail}
                      {appointment.customerPhone
                        ? ` · ${appointment.customerPhone}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <AppointmentCornerMark
                      status={appointment.status}
                      vaccinationStatusAtBooking={
                        appointment.vaccinationStatusAtBooking
                      }
                      customerConfirmedAt={appointment.customerConfirmedAt}
                    />
                    <span className="inline-flex w-fit rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">
                      {appointment.appointmentTime} ·{" "}
                      {statusLabel(appointment.status)}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-text">{appointment.serviceName}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {formatServiceAddress({
                    street: appointment.addressStreet,
                    city: appointment.addressCity,
                    state: appointment.addressState,
                    zip: appointment.addressZip,
                  })}
                </p>
                {appointment.estimatedTotal != null ? (
                  <p className="mt-2 text-sm text-text">
                    Estimated {formatPrice(appointment.estimatedTotal)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-gold-dark">
                  {formatStaffVisitTiming(
                    appointment.serviceStartedAt,
                    appointment.serviceEndedAt,
                    appointment.timezone,
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <AppointmentActionLinks
                    appointment={appointment}
                    paidKinds={paidKinds[appointment.id] ?? []}
                    preview={preview}
                    onCancelled={refreshSelectedDay}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
