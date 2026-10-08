import {
  appointmentOverlapsBlocks,
  applyBlocksToSlots,
  type AvailabilityBlock,
} from "@/lib/appointments/availability-blocks";
import {
  applyClosureToSlots,
  isSlotClosed,
  type DayClosureRecord,
} from "@/lib/appointments/closures";
import { addDaysToIsoDate } from "@/lib/sms/schedule";

/** How far ahead the admin reschedule calendar lists every civil day. */
export const STAFF_RESCHEDULE_HORIZON_DAYS = 120;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Every on-the-hour start in a civil day, midnight through 11:00 PM. */
export function listStaffClockHourStarts() {
  const starts: number[] = [];
  for (let minute = 0; minute < 24 * 60; minute += 60) {
    starts.push(minute);
  }
  return starts;
}

/** Any whole minute from midnight up to, but not including, the next midnight. */
export function isStaffClockMinute(startMinutes: number) {
  return (
    Number.isInteger(startMinutes) &&
    startMinutes >= 0 &&
    startMinutes < 24 * 60
  );
}

/**
 * Today through the horizon, plus any extra dates (the visit's current day).
 * Weekends stay in the list. Studio hours are not consulted.
 */
export function listStaffRescheduleDates(
  today: string,
  extraDates: string[] = [],
  horizon = STAFF_RESCHEDULE_HORIZON_DAYS,
) {
  const dates = new Set<string>();
  for (let offset = 0; offset < horizon; offset += 1) {
    dates.add(addDaysToIsoDate(today, offset));
  }
  for (const extra of extraDates) {
    if (DATE_PATTERN.test(extra)) dates.add(extra);
  }
  return [...dates].sort();
}

/** Clock hours left after closures and availability blocks. Other visits do not hide hours. */
export function staffOpenClockStarts(
  closure: DayClosureRecord | null | undefined,
  blocks: AvailabilityBlock[],
  durationMinutes: number,
) {
  const gated = applyClosureToSlots(listStaffClockHourStarts(), closure);
  return applyBlocksToSlots(
    gated.slots,
    blocks,
    Math.max(1, durationMinutes),
  );
}

export function staffClockStartBlocked(
  closure: DayClosureRecord | null | undefined,
  blocks: AvailabilityBlock[],
  startMinutes: number,
  durationMinutes: number,
) {
  return (
    isSlotClosed(closure, startMinutes) ||
    appointmentOverlapsBlocks(
      blocks,
      startMinutes,
      Math.max(1, durationMinutes),
    )
  );
}
