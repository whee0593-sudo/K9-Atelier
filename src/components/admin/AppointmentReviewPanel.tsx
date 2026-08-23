"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AppointmentActionLinks } from "@/components/admin/AppointmentActionLinks";
import { formatPrice } from "@/lib/business";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { ChargeKind } from "@/lib/charges/types";
import { formatServiceAddress } from "@/lib/travel";

type ScheduleDay = {
  date: string;
  zoneId: string;
  zoneLabel: string;
  source: "staff" | "auto" | "weekly" | "open";
  appointmentCount: number;
};

type ZoneOption = { id: string; label: string };

function formatShortDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AppointmentReviewPanel() {
  const [appointments, setAppointments] = useState<AdminAppointmentRecord[]>(
    [],
  );
  const [todayAppointments, setTodayAppointments] = useState<
    AdminAppointmentRecord[]
  >([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [paidKinds, setPaidKinds] = useState<Record<string, ChargeKind[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/appointments", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        appointments?: AdminAppointmentRecord[];
        today?: AdminAppointmentRecord[];
        schedule?: ScheduleDay[];
        zones?: ZoneOption[];
        paidKinds?: Record<string, ChargeKind[]>;
      };

      if (response.status === 401) {
        setError("Sign in with your team email to review appointments.");
        return;
      }

      if (response.status === 403) {
        setError("Staff access required.");
        return;
      }

      if (!response.ok) {
        setError(body.error ?? "Could not load appointments.");
        return;
      }

      setAppointments(body.appointments ?? []);
      setTodayAppointments(body.today ?? []);
      setSchedule(body.schedule ?? []);
      setZones(body.zones ?? []);
      setPaidKinds(body.paidKinds ?? {});
    } catch {
      setError("Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  async function updateStatus(
    appointmentId: string,
    status: "confirmed" | "cancelled",
  ) {
    setBusyId(appointmentId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/appointments/${appointmentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Could not update appointment.");
        return;
      }

      await loadAppointments({ silent: true });
    } catch {
      setError("Could not update appointment.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendEnRoute(appointmentId: string) {
    setBusyId(appointmentId);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/appointments/${appointmentId}/en-route`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Could not send on-the-way text.");
        return;
      }

      setTodayAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId
            ? { ...appointment, enRouteSmsSentAt: new Date().toISOString() }
            : appointment,
        ),
      );
    } catch {
      setError("Could not send on-the-way text.");
    } finally {
      setBusyId(null);
    }
  }

  async function setDayZone(date: string, zoneId: string) {
    setBusyId(date);
    setError(null);

    try {
      const response = await fetch("/api/admin/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, zoneId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not update that day's area.");
        return;
      }
      await loadAppointments({ silent: true });
    } catch {
      setError("Could not update that day's area.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <p className="mt-8 text-sm text-text-muted">Loading pending appointments…</p>
    );
  }

  if (error && appointments.length === 0 && todayAppointments.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
        <p className="text-sm text-text">{error}</p>
        {error.includes("Sign in") ? (
          <Link
            href="/login?next=/admin/appointments"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Staff sign in
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void loadAppointments()}
            className="mt-4 text-sm font-medium text-gold-dark underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <AdminCalendar />

      <section>
        <h3 className="text-lg font-medium text-gold-dark">Route days</h3>
        <p className="mt-1 text-sm text-text-muted">
          Lock a day to one area, or leave it on Auto so the first booking that
          day sets the neighborhood.
        </p>
        {schedule.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            No upcoming bookable days yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-lavender/30 overflow-hidden rounded-2xl border border-lavender/30 bg-cream">
            {schedule.slice(0, 10).map((day) => {
              const busy = busyId === day.date;
              const sourceLabel =
                day.source === "staff"
                  ? "Staff"
                  : day.source === "auto"
                    ? "Auto"
                    : day.source === "weekly"
                      ? "Weekly default"
                      : "Open";
              return (
                <li
                  key={day.date}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gold-dark">
                      {formatShortDate(day.date)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {sourceLabel}
                      {day.appointmentCount > 0
                        ? ` · ${day.appointmentCount} booked`
                        : " · no bookings"}
                    </p>
                  </div>
                  <label className="sr-only" htmlFor={`zone-${day.date}`}>
                    Service area for {formatShortDate(day.date)}
                  </label>
                  <select
                    id={`zone-${day.date}`}
                    disabled={busy}
                    value={day.source === "open" ? "auto" : day.zoneId}
                    onChange={(event) =>
                      void setDayZone(day.date, event.target.value)
                    }
                    className="rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-text"
                  >
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {appointments.length === 0 ? (
        <div className="rounded-2xl border border-lavender/30 bg-cream p-8 text-center">
          <p className="font-medium text-gold-dark">All caught up</p>
          <p className="mt-2 text-sm text-text-muted">
            No appointments are waiting for confirmation.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {appointments.map((appointment) => {
            const busy = busyId === appointment.id;
            const customerLabel =
              appointment.customerName ??
              appointment.customerEmail ??
              "Unknown customer";

            return (
              <li
                key={appointment.id}
                className="rounded-2xl border border-lavender/30 bg-cream p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-medium text-gold-dark">
                      {appointment.petName}
                      {appointment.petBreed ? (
                        <span className="font-normal text-text-muted">
                          {" "}
                          · {appointment.petBreed}
                        </span>
                      ) : null}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {customerLabel}
                      {appointment.customerEmail && appointment.customerName
                        ? ` (${appointment.customerEmail})`
                        : null}
                    </p>
                    {appointment.customerPhone ? (
                      <p className="mt-1 text-sm text-text-muted">
                        {appointment.customerPhone}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">
                    Pending confirmation
                  </span>
                </div>

                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-text-muted">Service</dt>
                    <dd className="text-text">{appointment.serviceName}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">When</dt>
                    <dd className="text-text">
                      {formatShortDate(appointment.appointmentDate)} ·{" "}
                      {appointment.appointmentTime}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-text-muted">Address</dt>
                    <dd className="text-text">
                      {formatServiceAddress({
                        street: appointment.addressStreet,
                        city: appointment.addressCity,
                        state: appointment.addressState,
                        zip: appointment.addressZip,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Travel</dt>
                    <dd className="text-text">
                      {appointment.travelDistanceMiles} mi ·{" "}
                      {appointment.travelFee === 0
                        ? "Complimentary"
                        : formatPrice(appointment.travelFee)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Estimated total</dt>
                    <dd className="text-text">
                      {appointment.estimatedTotal == null
                        ? "Not provided"
                        : `From ${formatPrice(appointment.estimatedTotal)}`}
                    </dd>
                  </div>
                  {appointment.vaccinationStatusAtBooking === "needs_review" ? (
                    <div className="sm:col-span-2">
                      <dt className="text-text-muted">Vaccination</dt>
                      <dd className="text-red-700">
                        Pending staff review at time of booking
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/admin/vaccinations"
                    className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text transition hover:border-gold/40"
                  >
                    Review vaccinations
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateStatus(appointment.id, "confirmed")}
                    className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateStatus(appointment.id, "cancelled")}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h3 className="text-lg font-medium text-gold-dark">Today — drive order</h3>
        <p className="mt-1 text-sm text-text-muted">
          Confirmed visits in the order you should drive. Send an on-the-way
          text when you leave.
        </p>
        {todayAppointments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-lavender/30 bg-cream p-8 text-center">
            <p className="text-sm text-text-muted">
              No confirmed appointments on today&apos;s calendar.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {todayAppointments.map((appointment, index) => {
              const busy = busyId === appointment.id;
              const customerLabel =
                appointment.customerName ??
                appointment.customerEmail ??
                "Unknown customer";
              const alreadySent = Boolean(appointment.enRouteSmsSentAt);

              return (
                <li
                  key={appointment.id}
                  className="rounded-2xl border border-lavender/30 bg-cream p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-medium text-gold-dark">
                        {appointment.petName}
                        {appointment.petBreed ? (
                          <span className="font-normal text-text-muted">
                            {" "}
                            · {appointment.petBreed}
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-sm text-text-muted">
                        {customerLabel}
                        {appointment.customerPhone
                          ? ` · ${appointment.customerPhone}`
                          : ""}
                      </p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">
                      Stop {index + 1} · {appointment.appointmentTime}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-text">
                    {appointment.serviceName}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {formatServiceAddress({
                      street: appointment.addressStreet,
                      city: appointment.addressCity,
                      state: appointment.addressState,
                      zip: appointment.addressZip,
                    })}
                  </p>
                  <p className="mt-2 text-sm text-gold-dark">
                    {formatStaffVisitTiming(
                      appointment.serviceStartedAt,
                      appointment.serviceEndedAt,
                      appointment.timezone,
                    )}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || alreadySent || !appointment.customerPhone}
                      onClick={() => void sendEnRoute(appointment.id)}
                      className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark disabled:opacity-50"
                    >
                      {alreadySent
                        ? "On-the-way text sent"
                        : appointment.customerPhone
                          ? "Text: on the way"
                          : "No mobile number"}
                    </button>
                    <AppointmentActionLinks
                      appointment={appointment}
                      paidKinds={paidKinds[appointment.id] ?? []}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => void loadAppointments()}
        className="text-sm text-text-muted underline hover:text-text"
      >
        Refresh list
      </button>
    </div>
  );
}
