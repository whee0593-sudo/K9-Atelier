import type { AppointmentRecord } from "./types";
import { groupByVisit } from "@/lib/visits/notification-scope";
import { getAddOnService } from "@/lib/services";

/** Only an explicit shared visit joins appointments; matching dates are not enough. */
export function customerBookingVisits(appointments: AppointmentRecord[]) {
  return groupByVisit(appointments).map((pets) =>
    [...pets].sort((a, b) => (a.scheduledStart ?? 1440) - (b.scheduledStart ?? 1440)),
  );
}

export function customerVisitEstimate(appointments: AppointmentRecord[]) {
  const active = appointments.filter((pet) => pet.status !== "cancelled");
  if (!active.length || active.some((pet) => pet.estimatedTotal == null)) return null;
  return active.reduce((sum, pet) => sum + Math.round(pet.estimatedTotal! * 100), 0) / 100;
}

/** Use frozen booking amounts, never today's catalog prices for a past quote. */
export function customerAppointmentServiceLines(appointment: AppointmentRecord) {
  const addOnName = (id: string) => {
    const name = getAddOnService(id)?.name ?? id;
    const option = appointment.addOnOptions[id];
    return option ? `${name} — ${option}` : name;
  };
  const amount = appointment.estimatedTotal == null ? null
    : Math.round((appointment.estimatedTotal - appointment.travelFee) * 100) / 100;
  const extras = appointment.pricedAddOns;
  if (amount != null && extras != null) {
    const base = Math.round((amount - extras.reduce((sum, item) => sum + item.amount, 0)) * 100) / 100;
    if (base >= 0) return [
      { name: appointment.serviceName, amount: base },
      ...extras.map((item) => ({ name: item.label, amount: item.amount })),
      ...appointment.addOnIds
        .filter((id) => !extras.some((item) => item.id === id))
        .map((id) => ({ name: addOnName(id), amount: null })),
    ];
  }
  // Older records have no frozen add-on breakdown. Keep their saved combined price.
  const names = appointment.addOnIds.map(addOnName);
  return [{ name: [appointment.serviceName, ...names].join(" · "), amount }];
}
