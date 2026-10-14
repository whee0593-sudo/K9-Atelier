import { business } from "@/lib/business";
import { getDayBounds } from "@/lib/booking-schedule";
import { bookingWeightLbs, liveServiceDurationMinutes } from "@/lib/pets/weight";
import { calendarDateInBusinessTimezone } from "@/lib/sms/schedule";

export const OCCUPANCY_ANOMALY_MESSAGE =
  "Appointment occupancy could not be determined from a saved duration or weight. Blocking the unresolved part of the service day.";

export type OccupiedSourceRow = {
  id?: string;
  appointment_date?: string;
  address_lat?: number | null;
  address_lon?: number | null;
  scheduled_start?: number | null;
  service_id?: string | null;
  add_on_ids?: string[] | null;
  address_zip?: string | null;
  estimated_duration_minutes?: number | null;
  pets?: { weight_lbs?: unknown } | { weight_lbs?: unknown }[] | null;
  service_started_at?: string | null;
  service_ended_at?: string | null;
  visit_id?: string | null;
};

export type OccupiedStop = {
  lat: number | null;
  lon: number | null;
  zip: string | null;
  scheduledStart: number;
  durationMinutes: number;
};

export type OccupiedStopDecision = {
  stop: OccupiedStop;
  /** True when the real range could not be recovered and the block is conservative. */
  anomaly: boolean;
};

function firstPet(value: OccupiedSourceRow["pets"]) {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function positiveMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function savedServiceDuration(row: OccupiedSourceRow): number | null {
  if (!row.service_started_at || !row.service_ended_at) return null;
  const start = Date.parse(row.service_started_at);
  const end = Date.parse(row.service_ended_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const minutes = Math.round((end - start) / 60000);
  return minutes > 0 ? minutes : null;
}

function clockMinutes(instant: Date): number | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: business.booking.timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const value: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value;
  }
  let hour = Number(value.hour);
  if (hour === 24) hour = 0;
  const minute = Number(value.minute);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

/** Start minute from a recorded service start on the appointment's calendar day. */
function savedServiceStart(row: OccupiedSourceRow): number | null {
  if (!row.service_started_at || !row.appointment_date) return null;
  const instant = new Date(row.service_started_at);
  if (Number.isNaN(instant.getTime())) return null;
  if (calendarDateInBusinessTimezone(instant) !== row.appointment_date) return null;
  return clockMinutes(instant);
}

function successorGap(
  row: OccupiedSourceRow,
  peers: readonly OccupiedSourceRow[],
): number | null {
  const start = placedStart(row);
  if (!row.visit_id || start == null) return null;
  let next: number | null = null;
  for (const peer of peers) {
    if (peer === row || (row.id != null && peer.id === row.id)) continue;
    if (peer.visit_id !== row.visit_id) continue;
    if (typeof peer.scheduled_start !== "number" || peer.scheduled_start <= start) {
      continue;
    }
    if (next == null || peer.scheduled_start < next) next = peer.scheduled_start;
  }
  if (next == null) return null;
  const gap = next - start;
  return gap > 0 ? gap : null;
}

function conservativeBlock(start: number | null): { start: number; duration: number } {
  const { hoursStart, hoursEnd } = getDayBounds();
  if (start != null && start >= hoursStart && start < hoursEnd) {
    return { start, duration: hoursEnd - start };
  }
  return { start: hoursStart, duration: hoursEnd - hoursStart };
}

function placedStart(row: OccupiedSourceRow): number | null {
  return typeof row.scheduled_start === "number" && Number.isFinite(row.scheduled_start)
    ? row.scheduled_start
    : null;
}

/**
 * Occupancy for one saved appointment.
 * A stored duration wins. A live tier is used only with a valid weight.
 * Otherwise a recorded service interval or the next dog on the same visit
 * can restore the block. An unknown range blocks through the end of the
 * service day and is reported. Nothing is written back to the appointment.
 */
export function resolveOccupiedStop(
  row: OccupiedSourceRow,
  peers: readonly OccupiedSourceRow[] = [],
): OccupiedStopDecision {
  const stored = positiveMinutes(row.estimated_duration_minutes);
  const weight = bookingWeightLbs(firstPet(row.pets)?.weight_lbs);
  const live =
    stored == null && weight != null
      ? liveServiceDurationMinutes(
          String(row.service_id ?? ""),
          weight,
          Array.isArray(row.add_on_ids)
            ? row.add_on_ids.filter((id): id is string => typeof id === "string")
            : [],
        )
      : null;

  let start = placedStart(row);
  let duration = stored ?? live;
  let anomaly = false;

  if (duration == null) {
    const recorded = savedServiceDuration(row);
    const recordedStart = savedServiceStart(row);
    const gap = successorGap(row, peers);
    if (recorded != null && (start != null || recordedStart != null)) {
      duration = recorded;
      if (start == null) start = recordedStart;
    } else if (start != null && gap != null) {
      duration = gap;
    } else {
      const blocked = conservativeBlock(start);
      start = blocked.start;
      duration = blocked.duration;
      anomaly = true;
    }
  } else if (start == null) {
    const recordedStart = savedServiceStart(row);
    if (recordedStart != null) {
      start = recordedStart;
    } else {
      const blocked = conservativeBlock(null);
      start = blocked.start;
      duration = blocked.duration;
      anomaly = true;
    }
  }

  if (anomaly) {
    console.error(OCCUPANCY_ANOMALY_MESSAGE, {
      appointmentId: row.id ?? null,
      appointmentDate: row.appointment_date ?? null,
      scheduledStart: row.scheduled_start ?? null,
    });
  }

  return {
    anomaly,
    stop: {
      lat: typeof row.address_lat === "number" ? row.address_lat : null,
      lon: typeof row.address_lon === "number" ? row.address_lon : null,
      zip: typeof row.address_zip === "string" ? row.address_zip : null,
      scheduledStart: start ?? getDayBounds().hoursStart,
      durationMinutes: duration ?? getDayBounds().hoursEnd - getDayBounds().hoursStart,
    },
  };
}
