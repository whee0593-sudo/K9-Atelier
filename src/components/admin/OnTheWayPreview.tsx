"use client";

import { useState } from "react";
import { AppointmentActionLinks } from "@/components/admin/AppointmentActionLinks";
import { AppointmentCornerMark } from "@/components/admin/AppointmentCornerMark";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import { buildAppointmentEnRouteSms } from "@/lib/notifications";
import { formatServiceAddress } from "@/lib/travel";

const SAMPLE_APPOINTMENTS = buildPreviewOnTheWayAppointments();

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
        <p className="mt-2 text-sm text-text-muted">
          Confirmed visits in the order you should drive. Send an on-the-way
          text when you leave.
        </p>
        <ul className="mt-6 space-y-4">
          {appointments.map((appointment, index) => {
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
                  <div className="flex flex-col items-end gap-2">
                    <AppointmentCornerMark
                      status={appointment.status}
                      vaccinationStatusAtBooking={
                        appointment.vaccinationStatusAtBooking
                      }
                      customerConfirmedAt={appointment.customerConfirmedAt}
                    />
                    <span className="inline-flex w-fit rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">
                      Stop {index + 1} · {appointment.appointmentTime}
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
                          entry.id === appointment.id
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
        <p className="font-body mt-2 text-sm text-[#766F75]">
          Sent to the guest’s mobile when you tap Text: on the way. Sample for{" "}
          {sample?.petName}.
        </p>
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
