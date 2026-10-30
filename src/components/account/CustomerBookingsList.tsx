"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatReviewMoney } from "@/lib/booking-price";
import { customerBookingVisits, customerVisitEstimate, customerAppointmentServiceLines } from "@/lib/appointments/customer-visits";
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

export function CustomerVisitCard({ appointments }: { appointments: AppointmentRecord[] }) {
  const active = appointments.filter(pet => pet.status !== "cancelled");
  const first = active[0] ?? appointments[0];
  if (!first) return null;
  const mixed = new Set(appointments.map(pet => pet.status)).size > 1;
  const status = mixed
    ? appointments.some(pet => pet.status === "cancelled") ? "Partially cancelled" : "Pending confirmation"
    : appointmentStatusLabel(first.status);
  const total = customerVisitEstimate(appointments);
  const travelFee = active.reduce((sum, pet) => sum + pet.travelFee, 0);
  return (
    <li className="rounded-xl border border-lavender/30 bg-cream px-4 py-4">
      <div className="mb-4 flex justify-end">
        <span className="inline-flex rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">{status}</span>
      </div>
      <div className="space-y-7">
        {appointments.map(appointment => (
          <article key={appointment.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold text-gold-dark">{appointment.petName}</h4>
              {mixed ? <span className="text-xs text-text-muted">{appointmentStatusLabel(appointment.status)}</span> : null}
            </div>
            {appointment.petBreed ? <p className="text-sm text-text-muted">{appointment.petBreed}</p> : null}
            {customerAppointmentServiceLines(appointment).map((line, index) => (
              <div key={index} className="flex items-baseline justify-between gap-4 text-sm font-semibold text-text">
                <span className="min-w-0 break-words">{line.name}</span>
                {line.amount != null ? <span className="shrink-0 text-right tabular-nums">{formatReviewMoney(line.amount)}</span> : null}
              </div>
            ))}
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm font-semibold text-text">{formatShortDate(first.appointmentDate)} · {first.appointmentTime}</p>
      <p className="mt-1 text-sm text-text-muted">{formatServiceAddress({street:first.addressStreet,city:first.addressCity,state:first.addressState,zip:first.addressZip})}</p>
      {travelFee > 0 ? <div className="mt-5 flex justify-between gap-4 text-sm text-text"><span>Travel Fee</span><span className="shrink-0">{formatReviewMoney(travelFee)}</span></div> : null}
      {total != null ? (
        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-lavender/30 pt-4 text-sm font-semibold text-text">
          <span>Estimated Total</span><span className="shrink-0 text-right tabular-nums">{formatReviewMoney(total)}</span>
        </div>
      ) : active.length ? <p className="mt-5 text-sm text-text-muted">Estimate to be confirmed.</p> : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
        {appointments.filter(appointmentIsUpcoming).map(appointment => (
          <Link key={appointment.id} href={`/account/appointments/${appointment.id}`} className="inline-flex text-sm font-medium text-gold-dark underline">
            {appointments.length > 1 ? `Change or cancel — ${appointment.petName}` : "Change or cancel"}
          </Link>
        ))}
      </div>
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

  const visits = customerBookingVisits(appointments);
  const upcoming = visits.filter(pets => pets.some(appointmentIsUpcoming));
  const past = visits.filter(pets => !pets.some(appointmentIsUpcoming));

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
            {upcoming.map((pets) => (
              <CustomerVisitCard key={pets[0].visitId ?? pets[0].id} appointments={pets} />
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
            {past.map((pets) => (
              <CustomerVisitCard key={pets[0].visitId ?? pets[0].id} appointments={pets} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
