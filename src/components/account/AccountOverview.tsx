import React from "react";
import { ExpandableCard } from "@/components/account/ExpandableCard";
import { CustomerVisitCard } from "@/components/account/CustomerBookingsList";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { overviewAppointments } from "@/lib/account-overview";
import { formatAccountDate } from "@/lib/account-nav-summaries";

export function AccountOverview({ appointments, pets, now }: {
  appointments: AppointmentRecord[]; pets: Array<{ id: string; weightLbs: number | null }>; now?: Date;
}) {
  const selected = overviewAppointments(appointments, now);
  if (!selected.appointments.length) return <p className="text-sm text-text-muted">No appointments yet.</p>;
  const first = selected.appointments[0];
  return <section className="space-y-4">
    <h2 className="text-2xl font-semibold text-gold-dark">{selected.upcoming ? "Next appointment" : "Last appointment"}</h2>
    <p className="text-sm text-text-muted">{formatAccountDate(first.appointmentDate)} · {first.appointmentTime}</p>
    <ExpandableCard summary={<>{selected.appointments.map(a => {
      const weight = a.petWeightLbs ?? pets.find(p => p.id === a.petId)?.weightLbs;
      return <span key={a.id} className="mb-3 block last:mb-0">
        <span className="block font-medium">{[a.petName, a.petBreed, weight != null ? `${weight} lb` : null].filter(Boolean).join(" · ")}</span>
        <span className="block">{a.serviceName}</span>
      </span>;
    })}</>}>
      <ul><CustomerVisitCard appointments={selected.appointments} /></ul>
    </ExpandableCard>
  </section>;
}
