export type FollowUpPet = {
  id: string;
  status: string;
  serviceEndedAt: string | null;
  followupSentAt: string | null;
};

/**
 * Next-day follow-up waits until every dog still on the visit has checked out.
 * Checkout is service_ended_at, the same moment the checkout text is allowed.
 * Waiting does not mark the visit sent, so a later run can still send.
 */
export function planNextDayFollowUp(
  pets: FollowUpPet[],
): "wait" | "skip" | "send" {
  const active = pets.filter((pet) => pet.status !== "cancelled");
  if (active.length === 0) return "skip";
  if (active.every((pet) => pet.followupSentAt)) return "skip";
  if (active.some((pet) => !pet.serviceEndedAt)) return "wait";
  return "send";
}

/** Days after the visit date we may still send a follow-up that had to wait. */
export const NEXT_DAY_FOLLOWUP_CATCHUP_DAYS = 14;
