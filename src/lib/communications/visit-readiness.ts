import {
  addDaysToIsoDate,
  calendarDateInBusinessTimezone,
  hourInBusinessTimezone,
} from "@/lib/sms/schedule";
import {
  REBOOK_REMINDER_CATCHUP_DAYS,
  REBOOK_REMINDER_DAYS,
} from "@/lib/email/rebook-reminders";

export const VISIT_NOTICE_SEND_HOUR = 10;

export type VisitDogFact = {
  appointmentId: string;
  status: string;
  serviceEndedAt: string | null;
  followupSentAt?: string | null;
  reminderStatus?: string | null;
  /** Set when this dog already recorded the logistics SMS being sent. */
  logisticsSentAt?: string | null;
  petName?: string | null;
};

export function activeVisitDogs(dogs: VisitDogFact[]) {
  return dogs.filter((dog) => dog.status !== "cancelled");
}

export function joinPetNames(names: Array<string | null | undefined>) {
  const clean = names.map((name) => name?.trim() ?? "").filter(Boolean);
  if (clean.length === 0) return "your dog";
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function endedInstant(dog: VisitDogFact) {
  const raw = dog.serviceEndedAt?.trim() ?? "";
  if (!raw) return null;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return null;
  return time;
}

export function lastCompletionInstant(dogs: VisitDogFact[]) {
  const active = activeVisitDogs(dogs);
  if (active.length === 0) return null;
  const times = active.map(endedInstant);
  if (times.some((time) => time == null)) return null;
  return new Date(Math.max(...(times as number[])));
}

export function merchantVisitIsConfirmed(dogs: Array<{ status: string }>) {
  const active = dogs.filter((dog) => dog.status !== "cancelled");
  return active.length > 0 && active.every((dog) => dog.status === "confirmed");
}

export function planVisitLogisticsSms(input: {
  event: "en_route" | "checkout_ready";
  dogs: VisitDogFact[];
}) {
  const active = activeVisitDogs(input.dogs);
  if (active.length === 0) {
    return { action: "empty" as const, appointmentIds: [] as string[] };
  }
  const appointmentIds = active.map((dog) => dog.appointmentId);
  if (input.event === "checkout_ready" && !lastCompletionInstant(active)) {
    return { action: "wait" as const, reason: "waiting_for_checkout" as const, appointmentIds };
  }
  if (
    input.event === "en_route" &&
    active.some((dog) => Boolean(dog.logisticsSentAt))
  ) {
    return { action: "already_sent" as const, appointmentIds };
  }
  return { action: "send" as const, appointmentIds };
}

/**
 * Checkout for this notice is the existing service_ended_at timestamp.
 * A payment-settled definition is not applied here.
 */
export function planNextDayFollowUp(input: { dogs: VisitDogFact[]; now: Date }) {
  const active = activeVisitDogs(input.dogs);
  if (active.length === 0) {
    return { action: "wait" as const, reason: "no_active_dogs" as const, appointmentIds: [] as string[] };
  }
  const appointmentIds = active.map((dog) => dog.appointmentId);
  if (active.some((dog) => dog.followupSentAt)) {
    return { action: "already_sent" as const, appointmentIds };
  }
  const completion = lastCompletionInstant(active);
  if (!completion) {
    return {
      action: "wait" as const,
      reason: "waiting_for_checkout" as const,
      appointmentIds,
    };
  }
  const dueOn = addDaysToIsoDate(calendarDateInBusinessTimezone(completion), 1);
  const today = calendarDateInBusinessTimezone(input.now);
  const hour = hourInBusinessTimezone(input.now);
  if (today < dueOn || (today === dueOn && hour < VISIT_NOTICE_SEND_HOUR)) {
    return { action: "wait" as const, reason: "too_early" as const, appointmentIds };
  }
  if (today === dueOn && hour === VISIT_NOTICE_SEND_HOUR) {
    return { action: "send" as const, appointmentIds };
  }
  return {
    action: "wait" as const,
    reason: "followup_window_missed" as const,
    appointmentIds,
  };
}

export function planRebookReminder(input: {
  dogs: VisitDogFact[];
  now: Date;
  hasOpenFuture: boolean;
}) {
  const active = activeVisitDogs(input.dogs);
  const appointmentIds = active.map((dog) => dog.appointmentId);
  if (active.length === 0) {
    return { action: "wait" as const, reason: "no_active_dogs" as const, appointmentIds };
  }
  if (active.some((dog) => dog.reminderStatus === "sending")) {
    return { action: "wait" as const, reason: "in_flight" as const, appointmentIds };
  }
  if (active.some((dog) => dog.reminderStatus === "sent")) {
    return { action: "already_sent" as const, appointmentIds };
  }
  if (active.some((dog) => dog.reminderStatus === "skipped")) {
    return { action: "already_skipped" as const, appointmentIds };
  }
  const completion = lastCompletionInstant(active);
  if (!completion) {
    return {
      action: "wait" as const,
      reason: "waiting_for_checkout" as const,
      appointmentIds,
    };
  }
  const dueOn = addDaysToIsoDate(
    calendarDateInBusinessTimezone(completion),
    REBOOK_REMINDER_DAYS,
  );
  const catchupOn = addDaysToIsoDate(dueOn, REBOOK_REMINDER_CATCHUP_DAYS);
  const today = calendarDateInBusinessTimezone(input.now);
  const hour = hourInBusinessTimezone(input.now);
  if (today < dueOn || (today === dueOn && hour < VISIT_NOTICE_SEND_HOUR)) {
    return { action: "wait" as const, reason: "too_early" as const, appointmentIds };
  }
  if (!((today === dueOn || today === catchupOn) && hour === VISIT_NOTICE_SEND_HOUR)) {
    return { action: "wait" as const, reason: "window_missed" as const, appointmentIds };
  }
  if (input.hasOpenFuture) {
    return { action: "skip_future" as const, appointmentIds };
  }
  return { action: "send" as const, appointmentIds };
}
