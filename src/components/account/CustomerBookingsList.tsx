"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/business";
import {
  appointmentIsUpcoming,
  appointmentStatusLabel,
} from "@/lib/appointments/map";
import { fetchCustomerAppointments } from "@/lib/appointments/client";
import type { AppointmentRecord } from "@/lib/appointments/types";
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

function AppointmentCard({ appointment }: { appointment: AppointmentRecord }) {
  return (
    <li className="rounded-xl border border-lavender/30 bg-cream px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gold-dark">{appointment.petName}</p>
          <p className="mt-1 text-sm text-text">{appointment.serviceName}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            appointment.status === "cancelled"
              ? "bg-lavender-light/60 text-text-muted"
              : "bg-lavender-light text-gold-dark"
          }`}
        >
          {appointmentStatusLabel(appointment.status)}
        </span>
      </div>
      <p className="mt-3 text-sm text-text">
        {formatShortDate(appointment.appointmentDate)} ·{" "}
        {appointment.appointmentTime}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        {formatServiceAddress({
          street: appointment.addressStreet,
          city: appointment.addressCity,
          state: appointment.addressState,
          zip: appointment.addressZip,
        })}
      </p>
      {appointment.estimatedTotal != null ? (
        <p className="mt-3 text-sm text-text-muted">
          Estimated from {formatPrice(appointment.estimatedTotal)}
        </p>
      ) : null}
      {appointmentIsUpcoming(appointment) ? (
        <Link
          href={`/account/appointments/${appointment.id}`}
          className="mt-4 inline-flex text-sm font-medium text-gold-dark underline"
        >
          Change or cancel
        </Link>
      ) : null}
    </li>
  );
}

export function CustomerBookingsList() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const records = await fetchCustomerAppointments();
      setAppointments(records);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load appointments.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  if (loading) {
    return <p className="text-sm text-text-muted">Loading appointments…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-lavender/30 bg-cream px-4 py-6 text-sm">
        <p className="text-text">{error}</p>
        <button
          type="button"
          onClick={() => void loadAppointments()}
          className="mt-3 font-medium text-gold-dark underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const upcoming = appointments.filter(appointmentIsUpcoming);
  const past = appointments.filter((record) => !appointmentIsUpcoming(record));

  if (appointments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-lavender/50 bg-lavender-light/30 px-4 py-8 text-center text-sm text-text-muted">
        No appointments yet.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-base font-medium text-gold-dark">
          Upcoming Appointments
        </h3>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No upcoming appointments.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-base font-medium text-gold-dark">Past Appointments</h3>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No past appointments.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {past.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
