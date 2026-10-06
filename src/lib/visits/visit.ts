import { formatMinutesLabel } from "@/lib/appointments/closures";
import {
  chainSameAddressVisits,
  getDayBounds,
  getRoutingConfig,
  type InsertResult,
} from "@/lib/booking-schedule";
import type { AppointmentStatus } from "@/lib/appointments/types";

/**
 * A Visit is one on-site stop for a customer.
 * Pet profiles stay on the customer. Each dog on this stop stays its own appointment.
 * Notification and checkout grouping will move here in later phases; this module
 * is the data-layer contract they should use.
 */
export type VisitStatus =
  | "pending_confirmation"
  | "confirmed"
  | "completed"
  | "cancelled";

export type VisitPetAppointment = {
  id: string;
  visitId: string;
  petName: string;
  status: AppointmentStatus;
  serviceEndedAt?: string | null;
  servicePrice: number;
  estimatedDurationMinutes: number;
  scheduledStart: number | null;
};

export type ServiceAddressSnapshot = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export function isActivePetAppointment(
  appointment: Pick<VisitPetAppointment, "status">,
) {
  return appointment.status !== "cancelled";
}

export function isCompletedPetAppointment(
  appointment: Pick<VisitPetAppointment, "status" | "serviceEndedAt">,
) {
  return isActivePetAppointment(appointment) && Boolean(appointment.serviceEndedAt);
}

/**
 * Visit status follows the child appointments.
 * Cancelling one dog does not cancel the visit.
 * The visit becomes cancelled only when every pet appointment is cancelled.
 * The visit becomes completed when every remaining active pet has finished
 * (service_ended_at), even if another dog on the visit was cancelled.
 * Appointment status itself stays pending_confirmation | confirmed | cancelled.
 * "Completed" for a dog is service_ended_at, not a new appointment status.
 */
export function deriveVisitStatus(
  appointments: Array<
    Pick<VisitPetAppointment, "status" | "serviceEndedAt">
  >,
): VisitStatus {
  const active = appointments.filter(isActivePetAppointment);
  if (active.length === 0) return "cancelled";
  if (active.every((appointment) => appointment.serviceEndedAt)) {
    return "completed";
  }
  if (active.every((appointment) => appointment.status === "pending_confirmation")) {
    return "pending_confirmation";
  }
  return "confirmed";
}

export function activePetAppointments<T extends Pick<VisitPetAppointment, "status">>(
  appointments: T[],
) {
  return appointments.filter(isActivePetAppointment);
}

export function activePetCount(
  appointments: Array<Pick<VisitPetAppointment, "status">>,
) {
  return activePetAppointments(appointments).length;
}

/** Sum of active pets only. Cancelled dogs drop out of the visit duration. */
export function visitEstimatedDurationMinutes(
  appointments: Array<
    Pick<VisitPetAppointment, "status" | "estimatedDurationMinutes">
  >,
) {
  return activePetAppointments(appointments).reduce(
    (sum, appointment) => sum + appointment.estimatedDurationMinutes,
    0,
  );
}

/** Service prices only. Travel is not included. */
export function visitServiceTotal(
  appointments: Array<Pick<VisitPetAppointment, "status" | "servicePrice">>,
) {
  const total = activePetAppointments(appointments).reduce(
    (sum, appointment) => sum + appointment.servicePrice,
    0,
  );
  return Math.round(total * 100) / 100;
}

/**
 * Dogs that were actually serviced. Cancelled pets are excluded so a later
 * checkout, receipt, follow-up, or review does not treat them as completed.
 */
export function checkoutEligiblePets<
  T extends Pick<VisitPetAppointment, "status" | "serviceEndedAt">,
>(appointments: T[]) {
  return appointments.filter(isCompletedPetAppointment);
}

export function snapshotServiceAddress(
  address: ServiceAddressSnapshot,
): ServiceAddressSnapshot {
  return {
    street: address.street,
    city: address.city,
    state: address.state,
    zip: address.zip,
  };
}

/** Booking-time service price. Later catalog edits must not rewrite this. */
export function snapshotServicePrice(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function servicePriceFromEstimatedTotal(
  estimatedTotal: number | null,
  travelFeeOnAppointment: number,
) {
  if (estimatedTotal == null || !Number.isFinite(estimatedTotal)) return null;
  const travel = Number.isFinite(travelFeeOnAppointment) ? travelFeeOnAppointment : 0;
  if (travel > 0 && estimatedTotal >= travel) {
    return snapshotServicePrice(estimatedTotal - travel);
  }
  return snapshotServicePrice(estimatedTotal);
}

/**
 * Visit-level scheduler.
 * The admin chooses one arrival. Each active dog then gets its own
 * scheduled_start, back-to-back by exact duration, with no gap and no
 * 15-minute snap. Dogs on this visit do not share one start minute.
 * Customer-facing appointment_time on every child is that same arrival.
 */
export function scheduleVisitPetChain(input: {
  visitStartMinutes: number;
  durations: number[];
}): { ok: true; slots: InsertResult[] } | { ok: false } {
  if (!Number.isInteger(input.visitStartMinutes)) return { ok: false };
  if (input.durations.length === 0) return { ok: false };
  if (input.durations.some((minutes) => !Number.isInteger(minutes) || minutes <= 0)) {
    return { ok: false };
  }

  const chained = chainSameAddressVisits(input.visitStartMinutes, input.durations);
  const arrival = formatMinutesLabel(input.visitStartMinutes);
  return {
    ok: true,
    slots: chained.map((slot) => ({ ...slot, appointmentTime: arrival })),
  };
}

function gapBefore(spanStart: number, spanEnd: number, stop: { scheduledStart: number; durationMinutes: number }) {
  const stopEnd = stop.scheduledStart + stop.durationMinutes;
  if (spanStart >= stopEnd) return spanStart - stopEnd;
  if (stop.scheduledStart >= spanEnd) return stop.scheduledStart - spanEnd;
  return -1;
}

/**
 * True when the whole visit block fits beside other visits.
 * Pass only stops that belong to other visits. Dogs on the visit being
 * moved are not conflicts with each other.
 */
export function visitArrivalFits(input: {
  visitStartMinutes: number;
  durations: number[];
  otherStops: Array<{ scheduledStart: number; durationMinutes: number }>;
  bufferMinutes?: number;
}): boolean {
  const chain = scheduleVisitPetChain({
    visitStartMinutes: input.visitStartMinutes,
    durations: input.durations,
  });
  if (!chain.ok) return false;
  const first = chain.slots[0];
  const last = chain.slots[chain.slots.length - 1];
  if (!first || !last) return false;
  const spanEnd = last.scheduledStart + last.durationMinutes;
  const buffer = input.bufferMinutes ?? getRoutingConfig().travelBufferMinutes;
  return input.otherStops.every(
    (stop) => gapBefore(first.scheduledStart, spanEnd, stop) >= buffer,
  );
}

/** Quarter-hour arrivals whose full visit block fits other visits. */
export function listVisitArrivalMinutes(input: {
  durations: number[];
  otherStops: Array<{ scheduledStart: number; durationMinutes: number }>;
  bufferMinutes?: number;
}): number[] {
  const { hoursStart, hoursEnd } = getDayBounds();
  const starts: number[] = [];
  for (let start = hoursStart; start < hoursEnd; start += 15) {
    if (
      visitArrivalFits({
        visitStartMinutes: start,
        durations: input.durations,
        otherStops: input.otherStops,
        bufferMinutes: input.bufferMinutes,
      })
    ) {
      starts.push(start);
    }
  }
  return starts;
}

export function scheduleActivePetsFromVisitArrival<
  T extends {
    id: string;
    status: AppointmentStatus;
    estimatedDurationMinutes: number;
    scheduledStart: number | null;
  },
>(appointments: T[]) {
  const starts = appointments
    .map((row) => row.scheduledStart)
    .filter((value): value is number => typeof value === "number");
  if (starts.length === 0) return null;
  const visitStartMinutes = Math.min(...starts);
  const active = appointments
    .filter((row) => row.status !== "cancelled")
    .sort(
      (left, right) =>
        (left.scheduledStart ?? 0) - (right.scheduledStart ?? 0) ||
        left.id.localeCompare(right.id),
    );
  if (active.length === 0) {
    return {
      visitStartMinutes,
      slots: [] as Array<InsertResult & { id: string }>,
    };
  }
  const chain = scheduleVisitPetChain({
    visitStartMinutes,
    durations: active.map((row) => row.estimatedDurationMinutes),
  });
  if (!chain.ok) return null;
  return {
    visitStartMinutes,
    slots: active.map((row, index) => ({
      id: row.id,
      ...chain.slots[index]!,
    })),
  };
}

export function appendPetToVisitChain(input: {
  previousStart: number;
  previousDurationMinutes: number;
  durationMinutes: number;
}) {
  const chain = scheduleVisitPetChain({
    visitStartMinutes: input.previousStart,
    durations: [input.previousDurationMinutes, input.durationMinutes],
  });
  if (!chain.ok) return null;
  return chain.slots[1] ?? null;
}

export function cancelPetOnVisit<T extends VisitPetAppointment>(
  appointments: T[],
  appointmentId: string,
): T[] {
  return appointments.map((appointment) =>
    appointment.id === appointmentId
      ? { ...appointment, status: "cancelled" as const, serviceEndedAt: null }
      : appointment,
  );
}

export function cancelEntireVisit<T extends VisitPetAppointment>(
  appointments: T[],
): T[] {
  return appointments.map((appointment) =>
    appointment.status === "cancelled"
      ? appointment
      : { ...appointment, status: "cancelled" as const, serviceEndedAt: null },
  );
}

export function withServiceFinished<T extends VisitPetAppointment>(
  appointments: T[],
  appointmentId: string,
  serviceEndedAt: string,
): T[] {
  return appointments.map((appointment) =>
    appointment.id === appointmentId
      ? { ...appointment, serviceEndedAt }
      : appointment,
  );
}
