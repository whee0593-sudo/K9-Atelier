"use client";

import { operationalVisits } from "@/lib/visits/operations";
import React, { useState } from "react";
import { AppointmentActionLinks } from "@/components/admin/AppointmentActionLinks";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";
import { appointmentStatusLabel } from "@/lib/appointments/map";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import { buildAppointmentEnRouteSms } from "@/lib/notifications";
import { formatServiceAddress } from "@/lib/travel";

function sampleAppointments() {
  const samples = buildPreviewOnTheWayAppointments();
  const base = samples[0];
  if (!base) return samples;
  return [
    ...samples,
    {
      ...base,
      id: "preview-on-the-way-pending",
      petName: "Nori",
      petBreed: "Poodle",
      customerName: "Casey Lin",
      customerFirstName: "Casey",
      serviceName: "Signature Bath & Care",
      appointmentTime: "3:00–5:00 PM",
      status: "pending_confirmation" as const,
      confirmedAt: null,
      customerConfirmedAt: null,
      enRouteSmsSentAt: null,
    },
  ];
}

const SAMPLE_APPOINTMENTS = sampleAppointments();

export function OnTheWayPreview() {
  const [appointments, setAppointments] = useState(SAMPLE_APPOINTMENTS);
  const sample = appointments[0];
  const sms = sample
    ? buildAppointmentEnRouteSms({
        customerName: sample.customerFirstName ?? sample.customerName ?? "there",
        petName: sample.petName,
        serviceName: sample.serviceName,
        dateLabel: "Monday, August 24, 2026",
        timeLabel: sample.appointmentTime,
      })
    : "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 pb-16">
      <p className="rounded-[8px] border border-[#B99A5E] bg-[#FFFDFC] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#766F75]">
        Preview only · sample today drive order
      </p>

      <section>
        <h1 className="text-2xl font-semibold text-gold-dark">
          Today — drive order
        </h1>
        <ul className="mt-6 space-y-4">
          {operationalVisits(appointments).map(({ appointment, pets }) => {
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
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h3 className="font-medium text-gold-dark">{customerLabel}</h3>
                    {appointment.customerPhone ? <span className="text-sm text-text-muted">{appointment.customerPhone}</span> : null}
                    <span className="text-sm text-text-muted">{appointment.appointmentTime}</span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                  {formatServiceAddress({
                    street: appointment.addressStreet,
                    city: appointment.addressCity,
                    state: appointment.addressState,
                    zip: appointment.addressZip,
                  })}
                </p>
                  <p className="mt-2 text-xs font-medium text-gold-dark">
                    {appointmentStatusLabel(appointment.status)}
                  </p>
                  <ul className="mt-3 space-y-1" aria-label="Pets and services">
                    {pets.map(pet => <li key={pet.id} className="text-sm text-text">{pet.petName} — {pet.serviceName}</li>)}
                  </ul>
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
                    disabled={alreadySent || !appointment.customerPhone}
                    onClick={() =>
                      setAppointments((current) =>
                        current.map((entry) =>
                          entry.id === appointment.id || Boolean(entry.visitId && entry.visitId === appointment.visitId)
                            ? {
                                ...entry,
                                enRouteSmsSentAt: new Date().toISOString(),
                              }
                            : entry,
                        ),
                      )
                    }
                    className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark disabled:opacity-50"
                  >
                    {alreadySent
                      ? "On-the-way text sent"
                      : appointment.customerPhone
                        ? "Text: on the way"
                        : "No mobile number"}
                  </button>
                  <AppointmentActionLinks
                      driveOrder
                    appointment={appointment}
                    paidKinds={[]}
                    preview
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-3xl text-[#2F2930]">On-the-way text</h2>
        <div className="mx-auto mt-6 max-w-sm rounded-[28px] border border-[#E7DED2] bg-[#F3EEE6] px-4 py-6">
          <p className="text-center text-[11px] uppercase tracking-[0.14em] text-[#766F75]">
            Messages
          </p>
          <div className="mt-4 whitespace-pre-wrap rounded-[18px] rounded-bl-md bg-white px-4 py-3 text-[15px] leading-[1.5] break-words text-[#2F2930] shadow-[0_4px_16px_rgba(47,41,48,0.06)]">
            {sms}
          </div>
        </div>
      </section>
    </div>
  );
}
