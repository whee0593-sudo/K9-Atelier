import {
  chainSameAddressVisits,
  getDayBounds,
  listAvailableHourStarts,
  listHourlyStartMinutes,
  type GeoPoint,
  type RouteStop,
} from "@/lib/booking-schedule";
import { formatMinutesLabel } from "@/lib/appointments/closures";

export function formatEstimatedDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  return hours === 1 ? `1 hr ${remainder} min` : `${hours} hr ${remainder} min`;
}

function gapBetween(spanStart: number, spanEnd: number, stop: RouteStop) {
  const stopEnd = stop.scheduledStart + stop.durationMinutes;
  if (spanStart >= stopEnd) return spanStart - stopEnd;
  if (stop.scheduledStart >= spanEnd) return stop.scheduledStart - spanEnd;
  return -1;
}

/**
 * Why this start does not fit the estimated chain around existing visits.
 * Null when the chain fits inside studio hours and leaves the travel gap.
 */
export function describeStaffScheduleConflict(input: {
  startMinutes: number;
  durations: number[];
  stops: RouteStop[];
}): string | null {
  const durations = input.durations.filter((minutes) => minutes > 0);
  if (durations.length === 0) return null;

  const visits = chainSameAddressVisits(input.startMinutes, durations);
  const first = visits[0];
  const last = visits[visits.length - 1];
  if (!first || !last) return null;

  const spanStart = first.scheduledStart;
  const spanEnd = last.scheduledStart + last.durationMinutes;
  const bounds = getDayBounds();
  const buffer = bounds.travelBufferMinutes;
  const issues: string[] = [];

  if (spanEnd > bounds.hoursEnd || spanStart >= bounds.hoursEnd) {
    issues.push(`Studio hours end at ${formatMinutesLabel(bounds.hoursEnd)}.`);
  }

  const tightest = input.stops
    .map((stop) => ({ stop, gap: gapBetween(spanStart, spanEnd, stop) }))
    .filter((item) => item.gap < buffer)
    .sort((a, b) => a.gap - b.gap)[0];

  if (tightest) {
    const when = formatMinutesLabel(tightest.stop.scheduledStart);
    if (tightest.gap < 0) {
      issues.push(
        `That overlaps a visit already scheduled at ${when}. The route keeps a ${buffer}-minute gap between stops.`,
      );
    } else {
      issues.push(
        `A visit is already scheduled at ${when}. The route keeps a ${buffer}-minute gap between stops, and this estimate leaves ${tightest.gap} minutes.`,
      );
    }
  }

  if (issues.length === 0) return null;

  const total = durations.reduce((sum, minutes) => sum + minutes, 0);
  return `These services are estimated at ${formatEstimatedDuration(total)}, from ${formatMinutesLabel(spanStart)} to ${formatMinutesLabel(spanEnd)}. ${issues.join(" ")}`;
}

export function conflictsForStarts(
  starts: number[],
  durations: number[],
  stops: RouteStop[],
) {
  const conflicts: Record<string, string> = {};
  for (const start of starts) {
    const message = describeStaffScheduleConflict({
      startMinutes: start,
      durations,
      stops,
    });
    if (message) conflicts[String(start)] = message;
  }
  return conflicts;
}

export function retainConflicts(
  slots: number[],
  conflicts: Record<string, string>,
) {
  const allowed = new Set(slots.map(String));
  const next: Record<string, string> = {};
  for (const [start, message] of Object.entries(conflicts)) {
    if (allowed.has(start)) next[start] = message;
  }
  return next;
}

/** Hourly starts plus short reopen times. Conflicting hours stay selectable. */
export function listStaffOverrideHourStarts(input: {
  base: GeoPoint;
  incoming: GeoPoint;
  stops: RouteStop[];
  durations: number[];
}) {
  const reopen = listAvailableHourStarts(
    input.base,
    input.stops,
    input.incoming,
    30,
  );
  const slots = [...new Set([...listHourlyStartMinutes(), ...reopen])].sort(
    (a, b) => a - b,
  );
  return {
    slots,
    conflicts: conflictsForStarts(slots, input.durations, input.stops),
  };
}
