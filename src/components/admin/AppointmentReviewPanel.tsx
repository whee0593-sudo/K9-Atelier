"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/business";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { formatServiceAddress } from "@/lib/travel";

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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/appointments", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        appointments?: AdminAppointmentRecord[];
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

      setAppointments((current) =>
        current.filter((appointment) => appointment.id !== appointmentId),
      );
    } catch {
      setError("Could not update appointment.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <p className="mt-8 text-sm text-text-muted">Loading pending appointments…</p>
    );
  }

  if (error && appointments.length === 0) {
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

      {appointments.length > 0 ? (
        <button
          type="button"
          onClick={() => void loadAppointments()}
          className="text-sm text-text-muted underline hover:text-text"
        >
          Refresh list
        </button>
      ) : null}
    </div>
  );
}
