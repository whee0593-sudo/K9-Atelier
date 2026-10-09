import { formatVisitPetNames } from "@/lib/visits/pet-names";

/**
 * Service logistics are one customer message per visit.
 * Pet records stay on the dog and are never folded into these events.
 */
export const VISIT_LOGISTICS_EVENTS = [
  "booking_confirmation",
  "staff_confirmed",
  "staff_declined",
  "staff_cancelled",
  "reschedule_confirmation",
  "confirm_reminder_3_day",
  "customer_reply_c",
  "en_route",
  "checkout_ready",
  "payment_thank_you",
  "next_day_followup",
  "google_review_request",
  "rebook_reminder_21_day",
] as const;

export type VisitLogisticsEvent = (typeof VISIT_LOGISTICS_EVENTS)[number];

/** Notices that describe one dog's record, not the visit. */
export const PET_RECORD_NOTICES = [
  "rabies_vaccination",
  "pet_medical_behavior",
  "missing_pet_details",
] as const;

export type PetRecordNotice = (typeof PET_RECORD_NOTICES)[number];

const VISIT_EVENTS = new Set<string>(VISIT_LOGISTICS_EVENTS);
const PET_NOTICES = new Set<string>(PET_RECORD_NOTICES);

export function isVisitLogisticsEvent(event: string) {
  return VISIT_EVENTS.has(event);
}

export function isPetRecordNotice(notice: string) {
  return PET_NOTICES.has(notice);
}

export type VisitNoticePet = {
  id: string;
  petName: string;
  serviceName: string;
  status: string;
  serviceEndedAt: string | null;
  sex: string | null;
};

export function groupByVisit<T extends { id: string; visitId?: string | null }>(
  rows: T[],
) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.visitId ? `visit:${row.visitId}` : `appointment:${row.id}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.values()];
}

export function rescheduleNotificationEvent(date: string, timeLabel: string) {
  return `reschedule_confirmation:${date}:${timeLabel}`;
}

export type StaffStatusNoticePlan =
  | { send: false; reason: "waiting_for_siblings" }
  | {
      send: true;
      event: "staff_confirmed" | "staff_declined" | "staff_cancelled";
      scope: "visit" | "pet";
      eventKey: string;
      pets: VisitNoticePet[];
    };

/**
 * Confirm and full-visit cancel/decline wait until every dog on the visit
 * shares that outcome, then one message lists them.
 * Removing one dog while others remain is a single-dog notice.
 */
export function planStaffStatusNotice(input: {
  kind: "confirmed" | "declined" | "staff_cancelled";
  appointmentId: string;
  petName: string;
  serviceName?: string;
  siblings?: VisitNoticePet[];
}): StaffStatusNoticePlan {
  const fallback: VisitNoticePet = {
    id: input.appointmentId,
    petName: input.petName,
    serviceName: input.serviceName?.trim() || "Service",
    status: input.kind === "confirmed" ? "confirmed" : "cancelled",
    serviceEndedAt: null,
    sex: null,
  };
  const rows =
    input.siblings && input.siblings.some((pet) => pet.id === input.appointmentId)
      ? input.siblings
      : [fallback];
  const active = rows.filter((pet) => pet.status !== "cancelled");

  if (input.kind === "confirmed") {
    if (active.some((pet) => pet.status === "pending_confirmation")) {
      return { send: false, reason: "waiting_for_siblings" };
    }
    const pets = active.length > 0 ? active : [fallback];
    return {
      send: true,
      event: "staff_confirmed",
      scope: "visit",
      eventKey: "staff_confirmed",
      pets,
    };
  }

  const event = input.kind === "staff_cancelled" ? "staff_cancelled" : "staff_declined";
  if (active.length > 0) {
    const pet = rows.find((row) => row.id === input.appointmentId) ?? fallback;
    return {
      send: true,
      event,
      scope: "pet",
      eventKey: `${event}:${input.appointmentId}`,
      pets: [pet],
    };
  }

  return {
    send: true,
    event,
    scope: "visit",
    eventKey: event,
    pets: rows,
  };
}

/** Checkout text waits until every dog still on the visit has finished. */
export function petsReadyForCheckout(pets: VisitNoticePet[]) {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  if (active.length === 0) return null;
  if (active.some((pet) => !pet.serviceEndedAt)) return null;
  return active;
}

export function activeVisitPets(pets: VisitNoticePet[]) {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  return active.length > 0 ? active : null;
}

export function visitPetLabel(pets: Array<{ petName: string }>, fallback = "your dog") {
  return formatVisitPetNames(
    pets.map((pet) => pet.petName),
    fallback,
  );
}
