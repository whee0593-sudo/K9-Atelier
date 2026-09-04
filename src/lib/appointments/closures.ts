import type { TimePreference } from "@/lib/booking-schedule";

export type DayClosureRecord = {
  serviceDate: string;
  closedAllDay: boolean;
  closedMorning: boolean;
  closedAfternoon: boolean;
};

export type DayClosureInput = {
  closedAllDay?: boolean;
  closedMorning?: boolean;
  closedAfternoon?: boolean;
};

export type AvailabilityFlags = {
  available: boolean;
  morning: boolean;
  afternoon: boolean;
};

/** Normalize staff input into a stored closure, or null when the day is open. */
export function normalizeDayClosure(
  input: DayClosureInput,
): Omit<DayClosureRecord, "serviceDate"> | null {
  let closedAllDay = Boolean(input.closedAllDay);
  let closedMorning = Boolean(input.closedMorning);
  let closedAfternoon = Boolean(input.closedAfternoon);

  if (closedAllDay) {
    closedMorning = true;
    closedAfternoon = true;
  } else if (closedMorning && closedAfternoon) {
    closedAllDay = true;
  }

  if (!closedAllDay && !closedMorning && !closedAfternoon) {
    return null;
  }

  return { closedAllDay, closedMorning, closedAfternoon };
}

export function applyClosureToAvailability(
  flags: AvailabilityFlags,
  closure: DayClosureRecord | null | undefined,
): AvailabilityFlags {
  if (!closure) return flags;

  if (closure.closedAllDay) {
    return { available: false, morning: false, afternoon: false };
  }

  const morning = flags.morning && !closure.closedMorning;
  const afternoon = flags.afternoon && !closure.closedAfternoon;
  return {
    available: morning || afternoon,
    morning,
    afternoon,
  };
}

export function isPreferenceClosed(
  closure: DayClosureRecord | null | undefined,
  preference: TimePreference,
): boolean {
  if (!closure) return false;
  if (closure.closedAllDay) return true;
  if (preference === "morning") return closure.closedMorning;
  return closure.closedAfternoon;
}

export function closureMode(
  closure: DayClosureRecord | null | undefined,
): "open" | "day" | "morning" | "afternoon" {
  if (!closure) return "open";
  if (closure.closedAllDay) return "day";
  if (closure.closedMorning && !closure.closedAfternoon) return "morning";
  if (closure.closedAfternoon && !closure.closedMorning) return "afternoon";
  if (closure.closedMorning && closure.closedAfternoon) return "day";
  return "open";
}

export function closureShortLabel(
  closure: DayClosureRecord | null | undefined,
): string | null {
  const mode = closureMode(closure);
  if (mode === "day") return "Closed";
  if (mode === "morning") return "AM closed";
  if (mode === "afternoon") return "PM closed";
  return null;
}
