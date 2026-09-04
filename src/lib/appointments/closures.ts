import { business } from "@/lib/business";

export type DayClosureRecord = {
  serviceDate: string;
  closedAllDay: boolean;
  /** Clock hours (e.g. 9–15) whose on-the-hour starts are closed. */
  closedHours: number[];
};

export type DayClosureInput = {
  closedAllDay?: boolean;
  closedHours?: number[];
};

export type AvailabilityFlags = {
  available: boolean;
  slots: number[];
};

function parseHour(value: string) {
  return Number(value.split(":")[0]);
}

/** Bookable on-the-hour starts as clock hours, matching the studio day. */
export function listClosureHourOptions() {
  const startHour = parseHour(business.booking.hoursStart);
  const endHour = parseHour(business.booking.hoursEnd);
  const hours: number[] = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    hours.push(hour);
  }
  return hours;
}

const ALLOWED_HOURS = () => new Set(listClosureHourOptions());

function normalizeHours(hours: number[] | undefined): number[] {
  if (!Array.isArray(hours)) return [];
  const allowed = ALLOWED_HOURS();
  const unique = new Set<number>();
  for (const hour of hours) {
    if (!Number.isInteger(hour) || !allowed.has(hour)) continue;
    unique.add(hour);
  }
  return [...unique].sort((a, b) => a - b);
}

/** Normalize staff input into a stored closure, or null when the day is open. */
export function normalizeDayClosure(
  input: DayClosureInput,
): Omit<DayClosureRecord, "serviceDate"> | null {
  const options = listClosureHourOptions();
  const closedAllDay = Boolean(input.closedAllDay);
  const closedHours = closedAllDay ? [...options] : normalizeHours(input.closedHours);

  if (!closedAllDay && closedHours.length === 0) {
    return null;
  }

  const allHoursClosed =
    closedHours.length >= options.length &&
    options.every((hour) => closedHours.includes(hour));

  return {
    closedAllDay: closedAllDay || allHoursClosed,
    closedHours: closedAllDay || allHoursClosed ? [...options] : closedHours,
  };
}

export function applyClosureToSlots(
  slots: number[],
  closure: DayClosureRecord | null | undefined,
): AvailabilityFlags {
  if (!closure) {
    return { available: slots.length > 0, slots };
  }
  if (closure.closedAllDay) {
    return { available: false, slots: [] };
  }
  const blocked = new Set(closure.closedHours);
  const open = slots.filter((start) => !blocked.has(Math.floor(start / 60)));
  return { available: open.length > 0, slots: open };
}

export function isSlotClosed(
  closure: DayClosureRecord | null | undefined,
  startMinutes: number,
): boolean {
  if (!closure) return false;
  if (closure.closedAllDay) return true;
  return closure.closedHours.includes(Math.floor(startMinutes / 60));
}

export function closureShortLabel(
  closure: DayClosureRecord | null | undefined,
): string | null {
  if (!closure) return null;
  if (closure.closedAllDay) return "Closed";
  if (closure.closedHours.length === 1) {
    return `${formatHourLabel(closure.closedHours[0]!)} closed`;
  }
  if (closure.closedHours.length > 1) {
    return `${closure.closedHours.length} hrs closed`;
  }
  return null;
}

export function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}
