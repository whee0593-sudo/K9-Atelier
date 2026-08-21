import { business } from "@/lib/business";
import {
  getUpcomingBookableDates,
  parseDateValue,
  weekdayKey,
} from "@/lib/booking-slots";

export type GeoPoint = { lat: number; lon: number };

export type TimePreference = "morning" | "afternoon";

export type ServiceZone = {
  id: string;
  label: string;
  zips: string[];
};

export type DayPlanRecord = {
  serviceDate: string;
  zoneId: string;
  source: "staff" | "auto" | "weekly";
  anchor: GeoPoint | null;
};

export type RouteStop = {
  lat: number | null;
  lon: number | null;
  zip?: string | null;
  scheduledStart: number;
  durationMinutes: number;
};

export type InsertResult = {
  scheduledStart: number;
  durationMinutes: number;
  appointmentTime: string;
  usedPreference: TimePreference;
};

const NEARBY_ZONE_ID = "nearby";

export function getRoutingConfig() {
  return business.booking.routing;
}

export function parseClockToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getDayBounds() {
  const routing = getRoutingConfig();
  return {
    hoursStart: parseClockToMinutes(business.booking.hoursStart),
    hoursEnd: parseClockToMinutes(business.booking.hoursEnd),
    morningEndsAt: parseClockToMinutes(routing.morningEndsAt),
    travelBufferMinutes: routing.travelBufferMinutes,
    maxAppointmentsPerDay: routing.maxAppointmentsPerDay,
    clusterRadiusMiles: routing.clusterRadiusMiles,
  };
}

export function normalizeZip(zip: string) {
  return zip.replace(/\D/g, "").slice(0, 5);
}

export function zoneById(zoneId: string) {
  return getRoutingConfig().zones.find((zone) => zone.id === zoneId) ?? null;
}

export function zoneLabel(zoneId: string) {
  if (zoneId === NEARBY_ZONE_ID) return "Nearby stops";
  return zoneById(zoneId)?.label ?? zoneId;
}

export function inferZoneIdFromZip(zip: string) {
  const digits = normalizeZip(zip);
  if (!digits) return null;
  for (const zone of getRoutingConfig().zones) {
    if (zone.zips.includes(digits)) return zone.id;
  }
  return null;
}

export function haversineMiles(from: GeoPoint, to: GeoPoint) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function travelMinutesBetween(
  from: GeoPoint,
  to: GeoPoint,
  bufferMinutes = getRoutingConfig().travelBufferMinutes,
) {
  const miles = haversineMiles(from, to);
  return Math.max(bufferMinutes, Math.ceil(miles * 2.5));
}

function snapUp(minutes: number, step = 15) {
  return Math.ceil(minutes / step) * step;
}

function formatClockLabel(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  return {
    text: `${hour12}:${String(minute).padStart(2, "0")}`,
    ampm,
  };
}

export function formatArrivalWindow(startMinutes: number, durationMinutes: number) {
  const start = formatClockLabel(startMinutes);
  const end = formatClockLabel(startMinutes + durationMinutes);
  if (start.ampm === end.ampm) {
    return `${start.text}–${end.text} ${start.ampm}`;
  }
  return `${start.text} ${start.ampm} – ${end.text} ${end.ampm}`;
}

export function isMorningStart(startMinutes: number, morningEndsAt: number) {
  return startMinutes < morningEndsAt;
}

function stopPoint(stop: RouteStop, fallback: GeoPoint): GeoPoint {
  if (stop.lat != null && stop.lon != null) {
    return { lat: stop.lat, lon: stop.lon };
  }
  return fallback;
}

export function addressAllowedForPlan(
  plan: DayPlanRecord | null,
  zip: string,
  point: GeoPoint,
) {
  if (!plan) return true;
  if (plan.zoneId === NEARBY_ZONE_ID) {
    if (!plan.anchor) return true;
    return (
      haversineMiles(plan.anchor, point) <=
      getRoutingConfig().clusterRadiusMiles
    );
  }
  const zone = zoneById(plan.zoneId);
  if (!zone) return true;
  return zone.zips.includes(normalizeZip(zip));
}

export function weeklyDefaultZoneId(dateValue: string) {
  const weekday = weekdayKey(parseDateValue(dateValue));
  if (weekday === "saturday" || weekday === "sunday") return "auto";
  const defaults = getRoutingConfig().weeklyDefaults;
  return defaults[weekday] ?? "auto";
}

export function resolveEffectivePlan(
  dateValue: string,
  stored: DayPlanRecord | null,
): DayPlanRecord | null {
  if (stored) return stored;
  const weekly = weeklyDefaultZoneId(dateValue);
  if (!weekly || weekly === "auto") return null;
  return {
    serviceDate: dateValue,
    zoneId: weekly,
    source: "weekly",
    anchor: null,
  };
}

export function planFromFirstStop(dateValue: string, zip: string, point: GeoPoint) {
  const zoneId = inferZoneIdFromZip(zip) ?? NEARBY_ZONE_ID;
  return {
    serviceDate: dateValue,
    zoneId,
    source: "auto" as const,
    anchor: zoneId === NEARBY_ZONE_ID ? point : null,
  };
}

export function existingStopsConflictWithZone(
  stops: Array<{ zip?: string | null; lat: number | null; lon: number | null }>,
  zoneId: string,
  samplePoint?: GeoPoint,
) {
  if (zoneId === "auto" || zoneId === NEARBY_ZONE_ID) return false;
  const zone = zoneById(zoneId);
  if (!zone) return false;
  return stops.some((stop) => {
    if (stop.zip) return !zone.zips.includes(normalizeZip(stop.zip));
    if (stop.lat != null && stop.lon != null && samplePoint) {
      return (
        haversineMiles({ lat: stop.lat, lon: stop.lon }, samplePoint) >
        getRoutingConfig().clusterRadiusMiles
      );
    }
    return false;
  });
}

type InsertionCandidate = {
  scheduledStart: number;
  extraMiles: number;
  usedPreference: TimePreference;
};

function extraMilesForInsert(
  base: GeoPoint,
  stops: RouteStop[],
  index: number,
  incoming: GeoPoint,
) {
  const prevPoint = index === 0 ? base : stopPoint(stops[index - 1]!, base);
  const next = stops[index];
  const nextPoint = next ? stopPoint(next, base) : null;
  const added =
    haversineMiles(prevPoint, incoming) +
    (nextPoint ? haversineMiles(incoming, nextPoint) : 0);
  const removed = nextPoint ? haversineMiles(prevPoint, nextPoint) : 0;
  return Math.max(0, added - removed);
}

function collectInsertions(
  base: GeoPoint,
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  preference: TimePreference,
): InsertionCandidate[] {
  const bounds = getDayBounds();
  const sorted = [...stops].sort((a, b) => a.scheduledStart - b.scheduledStart);
  const candidates: InsertionCandidate[] = [];

  for (let index = 0; index <= sorted.length; index += 1) {
    const prev = sorted[index - 1];
    const next = sorted[index];
    const prevPoint = prev ? stopPoint(prev, base) : base;
    const nextPoint = next ? stopPoint(next, base) : null;

    const earliestRaw =
      index === 0
        ? bounds.hoursStart
        : (prev?.scheduledStart ?? bounds.hoursStart) +
          (prev?.durationMinutes ?? 0) +
          travelMinutesBetween(prevPoint, incoming, bounds.travelBufferMinutes);
    const earliest = snapUp(earliestRaw);

    const latestFinish = next
      ? next.scheduledStart -
        travelMinutesBetween(incoming, nextPoint ?? incoming, bounds.travelBufferMinutes)
      : bounds.hoursEnd;
    const latestStart = latestFinish - durationMinutes;
    if (earliest > latestStart) continue;

    const preferredStart =
      preference === "afternoon"
        ? Math.max(earliest, bounds.morningEndsAt)
        : earliest;
    if (preferredStart > latestStart) continue;
    if (
      preference === "morning" &&
      !isMorningStart(preferredStart, bounds.morningEndsAt)
    ) {
      continue;
    }
    if (
      preference === "afternoon" &&
      isMorningStart(preferredStart, bounds.morningEndsAt)
    ) {
      continue;
    }
    if (preferredStart + durationMinutes > bounds.hoursEnd) continue;

    candidates.push({
      scheduledStart: preferredStart,
      extraMiles: extraMilesForInsert(base, sorted, index, incoming),
      usedPreference: preference,
    });
  }

  return candidates;
}

export function findRouteInsertion(
  base: GeoPoint,
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  preference: TimePreference,
): InsertResult | null {
  const bounds = getDayBounds();
  if (stops.length >= bounds.maxAppointmentsPerDay) return null;
  if (durationMinutes > bounds.hoursEnd - bounds.hoursStart) return null;

  const preferred = collectInsertions(
    base,
    stops,
    incoming,
    durationMinutes,
    preference,
  );
  const fallbackPref: TimePreference =
    preference === "morning" ? "afternoon" : "morning";
  const fallback =
    preferred.length > 0
      ? []
      : collectInsertions(base, stops, incoming, durationMinutes, fallbackPref);
  const pool = preferred.length > 0 ? preferred : fallback;
  if (pool.length === 0) return null;

  pool.sort((a, b) => a.extraMiles - b.extraMiles || a.scheduledStart - b.scheduledStart);
  const best = pool[0]!;
  return {
    scheduledStart: best.scheduledStart,
    durationMinutes,
    appointmentTime: formatArrivalWindow(best.scheduledStart, durationMinutes),
    usedPreference: best.usedPreference,
  };
}

export function preferenceAvailability(
  base: GeoPoint,
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
) {
  return {
    morning: findRouteInsertion(base, stops, incoming, durationMinutes, "morning") != null,
    afternoon:
      findRouteInsertion(base, stops, incoming, durationMinutes, "afternoon") != null,
  };
}

export function listCalendarDates(count = 40) {
  return getUpcomingBookableDates(count).map((item) => item.value);
}
