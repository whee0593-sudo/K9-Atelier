import type { RouteLookup } from "./geo";
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

/** Booking starts every 30 minutes from opening until close. */
export function listBookingStartMinutes() {
  const { hoursStart, hoursEnd } = getDayBounds();
  const starts: number[] = [];
  for (let m = hoursStart; m < hoursEnd; m += 30) {
    starts.push(m);
  }
  return starts;
}

export function preferenceFromStart(startMinutes: number): TimePreference {
  const { morningEndsAt } = getDayBounds();
  return startMinutes < morningEndsAt ? "morning" : "afternoon";
}

export function isMorningStart(startMinutes: number, morningEndsAt: number) {
  return startMinutes < morningEndsAt;
}

export function addressAllowedForPlan(
  plan: DayPlanRecord | null,
  zip: string,
  point: GeoPoint,
  route?: RouteLookup,
) {
  if (!plan) return true;
  if (plan.zoneId === NEARBY_ZONE_ID) {
    if (!plan.anchor) return false;
    return (
      (route?.(plan.anchor, point)?.miles ?? Infinity) <=
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

export function planFromFirstStop(dateValue: string, zip: string, point: GeoPoint | null) {
  const zoneId = inferZoneIdFromZip(zip) ?? NEARBY_ZONE_ID;
  return {
    serviceDate: dateValue,
    zoneId,
    source: "auto" as const,
    anchor: zoneId === NEARBY_ZONE_ID ? point : null,
  };
}

export function existingStopsConflictWithZone(stops: RouteStop[], zoneId: string) {
  const zone = zoneById(zoneId);
  return zone != null && stops.some((stop) => !zone.zips.includes(normalizeZip(stop.zip ?? "")));
}

type InsertionCandidate = {
  scheduledStart: number;
  usedPreference: TimePreference;
};

type OpenWindow = {
  earliest: number;
  latestStart: number;
};

function adjacentRouteAllowed(stop: RouteStop, incoming: GeoPoint, route: RouteLookup, prior: boolean) {
  if (stop.lat == null || stop.lon == null) return false;
  const neighbor = { lat: stop.lat, lon: stop.lon };
  const drive = prior ? route(neighbor, incoming) : route(incoming, neighbor);
  return drive != null && drive.minutes <= getRoutingConfig().maxAdjacentDriveMinutes;
}

export function adjacentDriveFits(stops: RouteStop[], incoming: GeoPoint, start: number, route: RouteLookup) {
  const sorted = [...stops].sort((a, b) => a.scheduledStart - b.scheduledStart);
  const nextIndex = sorted.findIndex((stop) => stop.scheduledStart >= start);
  const next = nextIndex < 0 ? undefined : sorted[nextIndex];
  const previous = sorted[(nextIndex < 0 ? sorted.length : nextIndex) - 1];
  return (!previous || adjacentRouteAllowed(previous, incoming, route, true)) &&
    (!next || adjacentRouteAllowed(next, incoming, route, false));
}

/** Gaps that leave the configured buffer and satisfy the adjacent drive limit. */
function openWindows(
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  route?: RouteLookup,
): OpenWindow[] {
  const bounds = getDayBounds();
  const driveGap = bounds.travelBufferMinutes;
  const sorted = [...stops].sort((a, b) => a.scheduledStart - b.scheduledStart);
  const windows: OpenWindow[] = [];

  for (let index = 0; index <= sorted.length; index += 1) {
    const prev = sorted[index - 1];
    const next = sorted[index];
    if (route && ((prev && !adjacentRouteAllowed(prev, incoming, route, true)) ||
      (next && !adjacentRouteAllowed(next, incoming, route, false)))) continue;
    const earliest =
      index === 0
        ? bounds.hoursStart
        : (prev?.scheduledStart ?? bounds.hoursStart) +
          (prev?.durationMinutes ?? 0) +
          driveGap;
    const latestFinish = next ? next.scheduledStart - driveGap : bounds.hoursEnd;
    const latestStart = latestFinish - durationMinutes;
    if (earliest > latestStart) continue;
    if (earliest + durationMinutes > bounds.hoursEnd) continue;
    windows.push({
      earliest,
      latestStart,
    });
  }

  return windows;
}

function startFitsWindow(start: number, window: OpenWindow, durationMinutes: number) {
  const { hoursEnd } = getDayBounds();
  return (
    start >= window.earliest &&
    start <= window.latestStart &&
    start + durationMinutes <= hoursEnd
  );
}

/** Half-hour starts, plus the exact minute a route reopens and each quarter hour after it. */
function isOfferedStart(
  start: number,
  windows: OpenWindow[],
  durationMinutes: number,
) {
  if (!windows.some((window) => startFitsWindow(start, window, durationMinutes))) {
    return false;
  }
  if (listBookingStartMinutes().includes(start)) return true;
  return windows.some((window) => {
    if (window.earliest % 60 === 0) return false;
    if (!startFitsWindow(start, window, durationMinutes)) return false;
    return start === window.earliest || start % 15 === 0;
  });
}

export function isWithinServiceDay(startMinutes: number) {
  const { hoursStart, hoursEnd } = getDayBounds();
  return (
    Number.isInteger(startMinutes) &&
    startMinutes >= hoursStart &&
    startMinutes < hoursEnd
  );
}

/**
 * Next start for another dog at the same address on the same visit.
 * The van is already on site, so no travel buffer is added between dogs.
 */
export function buildSameAddressCompanionInsertion(
  previousStart: number,
  previousDurationMinutes: number,
  durationMinutes: number,
): InsertResult | null {
  const bounds = getDayBounds();
  const next = chainSameAddressVisits(previousStart, [
    previousDurationMinutes,
    durationMinutes,
  ])[1];
  if (!next) return null;
  if (next.scheduledStart < bounds.hoursStart) return null;
  if (next.scheduledStart + next.durationMinutes > bounds.hoursEnd) return null;
  return next;
}

/** Back-to-back visits at one address, including a chain that runs past closing. */
export function chainSameAddressVisits(
  firstStart: number,
  durations: number[],
): InsertResult[] {
  const visits: InsertResult[] = [];
  let previousStart = firstStart;
  let previousDuration = 0;
  durations.forEach((durationMinutes, index) => {
    const scheduledStart =
      index === 0 ? firstStart : previousStart + previousDuration;
    visits.push({
      scheduledStart,
      durationMinutes,
      appointmentTime: formatArrivalWindow(scheduledStart, durationMinutes),
      usedPreference: preferenceFromStart(scheduledStart),
    });
    previousStart = scheduledStart;
    previousDuration = durationMinutes;
  });
  return visits;
}

/** Next same-address visit when an admin confirms a schedule past the usual limits. */
export function buildStaffOverrideCompanionInsertion(
  previousStart: number,
  previousDurationMinutes: number,
  durationMinutes: number,
): InsertResult {
  const chained = chainSameAddressVisits(previousStart, [
    previousDurationMinutes,
    durationMinutes,
  ]);
  return chained[1]!;
}

export function findRouteInsertionAtHour(
  _base: GeoPoint,
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  requestedStart: number,
  route?: RouteLookup,
): InsertResult | null {
  const bounds = getDayBounds();
  if (stops.length >= bounds.maxAppointmentsPerDay) return null;
  if (durationMinutes > bounds.hoursEnd - bounds.hoursStart) return null;
  if (
    !isOfferedStart(
      requestedStart,
      openWindows(stops, incoming, durationMinutes, route),
      durationMinutes,
    )
  ) {
    return null;
  }

  return {
    scheduledStart: requestedStart,
    durationMinutes,
    appointmentTime: formatArrivalWindow(requestedStart, durationMinutes),
    usedPreference: preferenceFromStart(requestedStart),
  };
}

export function listAvailableHourStarts(
  _base: GeoPoint,
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  route?: RouteLookup,
) {
  const bounds = getDayBounds();
  if (stops.length >= bounds.maxAppointmentsPerDay) return [];
  if (durationMinutes > bounds.hoursEnd - bounds.hoursStart) return [];

  const windows = openWindows(stops, incoming, durationMinutes, route);
  const starts = new Set<number>();
  for (const start of listBookingStartMinutes()) {
    if (isOfferedStart(start, windows, durationMinutes)) starts.add(start);
  }
  for (const window of windows) {
    if (window.earliest % 60 === 0) continue;
    if (isOfferedStart(window.earliest, windows, durationMinutes)) {
      starts.add(window.earliest);
    }
    const firstQuarter = Math.ceil(window.earliest / 15) * 15;
    for (let minute = firstQuarter; minute <= window.latestStart; minute += 15) {
      if (isOfferedStart(minute, windows, durationMinutes)) starts.add(minute);
    }
  }
  return [...starts].sort((a, b) => a - b);
}

function collectInsertions(
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  preference: TimePreference,
  route?: RouteLookup,
): InsertionCandidate[] {
  const bounds = getDayBounds();
  return openWindows(stops, incoming, durationMinutes, route).flatMap((window) => {
    const rounded = Math.ceil(window.earliest / 15) * 15;
    const start = preference === "afternoon" ? Math.max(rounded, bounds.morningEndsAt) : rounded;
    if (!startFitsWindow(start, window, durationMinutes) || preferenceFromStart(start) !== preference) return [];
    return [{ scheduledStart: start, usedPreference: preference }];
  });
}

export function findRouteInsertion(
  _base: GeoPoint,
  stops: RouteStop[],
  incoming: GeoPoint,
  durationMinutes: number,
  preference: TimePreference,
  route?: RouteLookup,
): InsertResult | null {
  const bounds = getDayBounds();
  if (stops.length >= bounds.maxAppointmentsPerDay) return null;
  if (durationMinutes > bounds.hoursEnd - bounds.hoursStart) return null;

  const preferred = collectInsertions(
    stops,
    incoming,
    durationMinutes,
    preference,
    route,
  );
  const fallbackPref: TimePreference =
    preference === "morning" ? "afternoon" : "morning";
  const fallback =
    preferred.length > 0
      ? []
      : collectInsertions(stops, incoming, durationMinutes, fallbackPref, route);
  const pool = preferred.length > 0 ? preferred : fallback;
  if (pool.length === 0) return null;

  pool.sort((a, b) => a.scheduledStart - b.scheduledStart);
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
