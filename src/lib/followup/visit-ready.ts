import {
  addDaysToIsoDate,
  calendarDateInBusinessTimezone,
  hourInBusinessTimezone,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";

export type FollowUpPet = {
  id: string;
  status: string;
  serviceEndedAt: string | null;
  followupSentAt: string | null;
};

export type FollowUpPlan = "wait" | "skip" | "missed" | "send" | "outside_window";

/**
 * Calendar date in America/New_York of the latest checkout among dogs still
 * on the visit. Cancelled dogs are ignored. Returns null while any active
 * dog has not finished.
 */
export function latestCompletionDate(
  pets: Array<{ status: string; serviceEndedAt: string | null }>,
) {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  if (active.length === 0 || active.some((pet) => !pet.serviceEndedAt)) {
    return null;
  }
  let latest = "";
  for (const pet of active) {
    const date = calendarDateInBusinessTimezone(new Date(pet.serviceEndedAt!));
    if (date > latest) latest = date;
  }
  return latest;
}

/**
 * The follow-up is due at 10:00 America/New_York on the day after the last
 * active dog finishes. A later morning does not send. Waiting does not mark
 * the visit sent. Payment is not part of this decision.
 */
export function planNextDayFollowUp(
  pets: FollowUpPet[],
  today: string,
): Exclude<FollowUpPlan, "outside_window"> {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  if (active.length === 0) return "skip";
  if (active.some((pet) => !pet.serviceEndedAt)) return "wait";
  const finishedOn = latestCompletionDate(active);
  if (!finishedOn) return "wait";
  const sendOn = addDaysToIsoDate(finishedOn, 1);
  if (today < sendOn) return "wait";
  if (today > sendOn) return "missed";
  if (active.every((pet) => pet.followupSentAt)) return "skip";
  return "send";
}

export function followUpDecision(pets: FollowUpPet[], now: Date): FollowUpPlan {
  if (hourInBusinessTimezone(now) !== 10) return "outside_window";
  return planNextDayFollowUp(pets, todayInBusinessTimezone(now));
}
