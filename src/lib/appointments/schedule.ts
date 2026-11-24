import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase/env";
import { resolveOccupiedStop } from "@/lib/appointments/occupied-stop";
import { getBaseAddressFormatted } from "@/lib/server/base-address";
import { geocodeBaseAddress, getDrivingRoute, routeKey, type DrivingRoute } from "@/lib/geo";
import {
  addressAllowedForPlan,
  adjacentDriveFits,
  existingStopsConflictWithZone,
  findRouteInsertionAtHour,
  formatArrivalWindow,
  getRoutingConfig,
  listAvailableHourStarts,
  listCalendarDates,
  planFromFirstStop,
  preferenceFromStart,
  resolveEffectivePlan,
  zoneLabel,
  type DayPlanRecord,
  type GeoPoint,
  type RouteStop,
} from "@/lib/booking-schedule";
import { isBookingStartInFuture, isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { getUpcomingStaffDates, isStaffBookingDate } from "@/lib/staff/booking-dates";
import {
  applyClosureToSlots,
  isSlotClosed,
  normalizeDayClosure,
  type DayClosureInput,
  type DayClosureRecord,
} from "@/lib/appointments/closures";
import { applyBlocksToSlots, appointmentOverlapsBlocks, groupBlocksByDate } from "@/lib/appointments/availability-blocks";
import { loadAvailabilityBlocks } from "@/lib/appointments/availability-block-store";
import {
  describeStaffZoneConflict,
  listStaffOverrideHourStarts,
  retainConflicts,
} from "@/lib/staff/schedule-conflict";
import {
  visitArrivalFits,
  visitSpanFitsScheduleBounds,
} from "@/lib/visits/visit";

export type OccupiedAppointment = RouteStop & {
  zip: string | null;
};

export type { DayClosureRecord };

type ScheduleError = { error: "misconfigured" | "server" };
type OccupiedDay = {
  stops: OccupiedAppointment[];
  bookedCount: number;
  firstBooking?: OccupiedRow;
};

function resolveOccupiedDayPlan(
  date: string,
  stored: DayPlanRecord | null,
  occupied?: OccupiedDay,
) {
  const effective = resolveEffectivePlan(date, stored);
  if (effective && effective.source !== "auto") return effective;

  const first = occupied?.firstBooking;
  if (!first) return effective;

  const point =
    first.address_lat != null && first.address_lon != null
      ? { lat: first.address_lat, lon: first.address_lon }
      : null;
  return planFromFirstStop(date, first.address_zip ?? "", point);
}

export function requireAdminClient() {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) return null;
  return createAdminClient();
}

export async function getBaseGeoPoint() {
  const formatted = getBaseAddressFormatted();
  if (!formatted) return null;
  return geocodeBaseAddress(formatted);
}

function mapPlanRow(row: {
  service_date: string;
  zone_id: string;
  source: "staff" | "auto";
  anchor_lat: number | null;
  anchor_lon: number | null;
}): DayPlanRecord {
  return {
    serviceDate: row.service_date,
    zoneId: row.zone_id,
    source: row.source,
    anchor:
      row.anchor_lat != null && row.anchor_lon != null
        ? { lat: row.anchor_lat, lon: row.anchor_lon }
        : null,
  };
}

export async function loadDayPlans(
  fromDate: string,
  toDate: string,
): Promise<{ plans: Map<string, DayPlanRecord> } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { plans: new Map() };

  const { data, error } = await admin
    .from("service_day_plans")
    .select("service_date, zone_id, source, anchor_lat, anchor_lon")
    .gte("service_date", fromDate)
    .lte("service_date", toDate);

  if (error) {
    console.error("loadDayPlans failed:", error.message);
    return { error: "server" as const };
  }

  const plans = new Map<string, DayPlanRecord>();
  for (const row of data ?? []) {
    plans.set(row.service_date, mapPlanRow(row));
  }
  return { plans };
}

function mapClosureRow(row: {
  service_date: string;
  closed_all_day: boolean;
  closed_hours: number[] | null;
}): DayClosureRecord {
  return {
    serviceDate: row.service_date,
    closedAllDay: Boolean(row.closed_all_day),
    closedHours: Array.isArray(row.closed_hours)
      ? row.closed_hours.filter((hour): hour is number => Number.isInteger(hour))
      : [],
  };
}

export async function loadDayClosures(
  fromDate: string,
  toDate: string,
): Promise<{ closures: Map<string, DayClosureRecord> } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { closures: new Map() };

  const { data, error } = await admin
    .from("service_day_closures")
    .select("service_date, closed_all_day, closed_hours")
    .gte("service_date", fromDate)
    .lte("service_date", toDate);

  if (error) {
    console.error("loadDayClosures failed:", error.message);
    return { error: "server" as const };
  }

  const closures = new Map<string, DayClosureRecord>();
  for (const row of data ?? []) {
    closures.set(row.service_date, mapClosureRow(row));
  }
  return { closures };
}

export async function upsertDayClosure(
  date: string,
  input: DayClosureInput,
): Promise<{ ok: true } | ScheduleError> {
  const normalized = normalizeDayClosure(input);
  if (!normalized) return deleteDayClosure(date);

  const admin = requireAdminClient();
  if (!admin) return { error: "misconfigured" as const };

  const { error } = await admin.from("service_day_closures").upsert(
    {
      service_date: date,
      closed_all_day: normalized.closedAllDay,
      closed_hours: normalized.closedHours,
    },
    { onConflict: "service_date" },
  );

  if (error) {
    console.error("upsertDayClosure failed:", error.message);
    return { error: "server" as const };
  }
  return { ok: true };
}

export async function deleteDayClosure(
  date: string,
): Promise<{ ok: true } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { error: "misconfigured" as const };

  const { error } = await admin
    .from("service_day_closures")
    .delete()
    .eq("service_date", date);

  if (error) {
    console.error("deleteDayClosure failed:", error.message);
    return { error: "server" as const };
  }
  return { ok: true };
}

export async function setStaffDayClosure(
  date: string,
  input: DayClosureInput & { clear?: boolean },
): Promise<{ ok: true } | ScheduleError> {
  if (input.clear) {
    return deleteDayClosure(date);
  }
  return upsertDayClosure(date, {
    closedAllDay: input.closedAllDay,
    closedHours: input.closedHours,
  });
}

type OccupiedRow = {
  id?: string;
  appointment_date: string;
  address_lat: number | null;
  address_lon: number | null;
  scheduled_start: number | null;
  service_id: string;
  add_on_ids: string[] | null;
  address_zip: string | null;
  estimated_duration_minutes?: number | null;
  service_started_at?: string | null;
  service_ended_at?: string | null;
  visit_id?: string | null;
  pets: { weight_lbs?: number | string | null } | { weight_lbs?: number | string | null }[] | null;
};

type OccupiedLoadOptions = {
  excludeAppointmentIds?: string[];
};

function mapOccupiedRow(
  row: OccupiedRow,
  peers: readonly OccupiedRow[],
): OccupiedAppointment {
  return resolveOccupiedStop(row, peers).stop;
}

export async function loadOccupiedStopsByDate(
  fromDate: string,
  toDate: string,
  options?: OccupiedLoadOptions,
): Promise<{ byDate: Map<string, OccupiedDay> } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { byDate: new Map() };

  const select =
    "id, appointment_date, address_lat, address_lon, scheduled_start, service_id, add_on_ids, address_zip, estimated_duration_minutes, service_started_at, service_ended_at, visit_id";
  let data: OccupiedRow[] | null = null;
  const withPets = await admin
    .from("appointments")
    .select(`${select}, pets ( weight_lbs )`)
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .neq("status", "cancelled")
    .order("created_at")
    .order("id");

  if (withPets.error) {
    console.error("loadOccupiedStopsByDate pets join failed:", withPets.error.message);
    const withoutPets = await admin
      .from("appointments")
      .select(select)
      .gte("appointment_date", fromDate)
      .lte("appointment_date", toDate)
      .neq("status", "cancelled")
      .order("created_at")
      .order("id");
    if (withoutPets.error) {
      console.error("loadOccupiedStopsByDate failed:", withoutPets.error.message);
      return { error: "server" as const };
    }
    data = (withoutPets.data ?? []) as OccupiedRow[];
  } else {
    data = (withPets.data ?? []) as OccupiedRow[];
  }

  const rows = data ?? [];
  const exclude = new Set(options?.excludeAppointmentIds ?? []);
  const byDate = new Map<string, OccupiedDay>();
  for (const row of rows) {
    const current = byDate.get(row.appointment_date) ?? {
      stops: [],
      bookedCount: 0,
    };
    current.firstBooking ??= row;
    byDate.set(row.appointment_date, current);
    if (row.id && exclude.has(row.id)) continue;
    current.bookedCount += 1;
    const peers = rows.filter((peer) => peer.appointment_date === row.appointment_date);
    current.stops.push(mapOccupiedRow(row, peers));
  }

  for (const entry of byDate.values()) {
    entry.stops.sort((a, b) => a.scheduledStart - b.scheduledStart);
  }

  return { byDate };
}

export async function loadOccupiedStops(
  dateValue: string,
  options?: OccupiedLoadOptions,
): Promise<OccupiedDay | ScheduleError> {
  const result = await loadOccupiedStopsByDate(dateValue, dateValue, options);
  if ("error" in result) return result;
  return result.byDate.get(dateValue) ?? { stops: [], bookedCount: 0 };
}

export async function upsertDayPlan(plan: {
  serviceDate: string;
  zoneId: string;
  source: "staff" | "auto";
  anchor: GeoPoint | null;
}, options?: { keepExisting?: boolean }): Promise<{ ok: true } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { error: "misconfigured" as const };

  const { error } = await admin.from("service_day_plans").upsert(
    {
      service_date: plan.serviceDate,
      zone_id: plan.zoneId,
      source: plan.source,
      anchor_lat: plan.anchor?.lat ?? null,
      anchor_lon: plan.anchor?.lon ?? null,
    },
    { onConflict: "service_date", ignoreDuplicates: options?.keepExisting },
  );

  if (error) {
    console.error("upsertDayPlan failed:", error.message);
    return { error: "server" as const };
  }
  return { ok: true as const };
}

export async function deleteDayPlan(
  serviceDate: string,
): Promise<{ ok: true } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { error: "misconfigured" as const };

  const { error } = await admin
    .from("service_day_plans")
    .delete()
    .eq("service_date", serviceDate);

  if (error) {
    console.error("deleteDayPlan failed:", error.message);
    return { error: "server" as const };
  }
  return { ok: true as const };
}

function createRouteLoader() {
  const requests = new Map<string, Promise<DrivingRoute | null>>();
  return (from: GeoPoint, to: GeoPoint) => {
    const key = routeKey(from, to);
    const request = requests.get(key) ?? getDrivingRoute(from, to);
    requests.set(key, request);
    return request;
  };
}

async function loadRoutes(
  plan: DayPlanRecord | null,
  point: GeoPoint,
  stops: RouteStop[],
  load = createRouteLoader(),
) {
  const routes = new Map<string, DrivingRoute | null>();
  async function add(from: GeoPoint, to: GeoPoint) {
    routes.set(routeKey(from, to), await load(from, to));
  }

  const anchor = plan?.zoneId === "nearby" ? plan.anchor : null;
  await Promise.all([
    ...(anchor ? [add(anchor, point)] : []),
    ...stops.flatMap((stop) => {
      if (stop.lat == null || stop.lon == null) return [];
      const neighbor = { lat: stop.lat, lon: stop.lon };
      return [add(point, neighbor), add(neighbor, point)];
    }),
  ]);
  return (from: GeoPoint, to: GeoPoint) => routes.get(routeKey(from, to)) ?? null;
}

export async function getAvailabilityForAddress(input: {
  point: GeoPoint;
  zip: string;
  durationMinutes: number;
  base: GeoPoint;
  excludeAppointmentIds?: string[];
  extraDates?: string[];
  /** Staff booking: keep every start hour and attach estimate conflicts. */
  visitDurations?: number[];
  staffBooking?: boolean;
}): Promise<
  | {
      days: Array<{
        date: string;
        available: boolean;
        slots: number[];
        conflicts?: Record<string, string>;
      }>;
    }
  | ScheduleError
> {
  const extraDates = input.extraDates ?? [];
  const dates = input.staffBooking ? getUpcomingStaffDates(40).map((day) => day.value) : listCalendarDates(40);
  for (const extra of extraDates) {
    if (!dates.includes(extra)) dates.unshift(extra);
  }
  dates.sort();
  if (dates.length === 0) return { days: [] };

  const fromDate = dates[0]!;
  const toDate = dates[dates.length - 1]!;
  const [plansResult, occupiedResult, closuresResult, blocksResult] =
    await Promise.all([
      loadDayPlans(fromDate, toDate),
      loadOccupiedStopsByDate(fromDate, toDate, {
        excludeAppointmentIds: input.excludeAppointmentIds,
      }),
      loadDayClosures(fromDate, toDate),
      loadAvailabilityBlocks(fromDate, toDate),
    ]);
  if ("error" in plansResult) return plansResult;
  if ("error" in occupiedResult) return occupiedResult;
  if ("error" in closuresResult) return closuresResult;
  if ("error" in blocksResult) {
    console.error("getAvailabilityForAddress blocks:", blocksResult.error);
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }

  const { plans } = plansResult;
  const { byDate: occupiedByDate } = occupiedResult;
  const { closures } = closuresResult;
  const blocksByDate = groupBlocksByDate(blocksResult.blocks);

  const days = [];
  const load = createRouteLoader();
  async function getDay(date: string) {
    if (!extraDates.includes(date) && !(input.staffBooking ? isStaffBookingDate(date) : isDateBookable(parseDateValue(date)))) {
      return {
        date,
        available: false,
        slots: [] as number[],
      };
    }

    const closure = closures.get(date) ?? null;
    const dayBlocks = blocksByDate.get(date) ?? [];
    if (closure?.closedAllDay || dayBlocks.some((block) => block.allDay)) {
      return { date, available: false, slots: [] as number[] };
    }

    const occupied = occupiedByDate.get(date) ?? {
      stops: [],
      bookedCount: 0,
    };

    if (occupied.bookedCount >= getRoutingConfig().maxAppointmentsPerDay) {
      return { date, available: false, slots: [] as number[] };
    }

    const plan = resolveOccupiedDayPlan(date, plans.get(date) ?? null, occupied);
    if (!input.staffBooking && plan?.zoneId !== "nearby" &&
        !addressAllowedForPlan(plan, input.zip, input.point)) {
      return { date, available: false, slots: [] as number[] };
    }
    const route = await loadRoutes(plan, input.point, occupied.stops, load);
    if (!input.staffBooking && !addressAllowedForPlan(plan, input.zip, input.point, route)) {
      return { date, available: false, slots: [] as number[] };
    }

    const staffDurations = input.visitDurations?.filter((minutes) => minutes > 0);
    if (staffDurations && staffDurations.length > 0) {
      const override = listStaffOverrideHourStarts({
        base: input.base,
        incoming: input.point,
        stops: occupied.stops,
        durations: staffDurations,
        zoneConflict: describeStaffZoneConflict(plan, input.zip, input.point, route),
        route,
      });
      const gated = applyClosureToSlots(override.slots.filter((start) =>
        isBookingStartInFuture(date, start) && adjacentDriveFits(occupied.stops, input.point, start, route)), closure);
      const withBlocks = applyBlocksToSlots(gated.slots, dayBlocks, 1);
      const conflicts = retainConflicts(withBlocks.slots, override.conflicts);
      return {
        date,
        available: withBlocks.slots.length > 0,
        slots: withBlocks.slots,
        conflicts,
      };
    }

    const openSlots = listAvailableHourStarts(
      input.base,
      occupied.stops,
      input.point,
      input.durationMinutes,
      route,
    );
    const gated = applyClosureToSlots(openSlots.filter((start) => isBookingStartInFuture(date, start)), closure);
    const withBlocks = applyBlocksToSlots(
      gated.slots,
      dayBlocks,
      input.durationMinutes,
    );
    return {
      date,
      available: withBlocks.available,
      slots: withBlocks.slots,
    };
  }

  for (let index = 0; index < dates.length; index += 4) {
    days.push(...await Promise.all(dates.slice(index, index + 4).map(getDay)));
  }

  return { days };
}

export async function assignArrivalWindow(input: {
  date: string;
  point: GeoPoint;
  zip: string;
  durationMinutes: number;
  slotStartMinutes: number;
  base: GeoPoint;
  excludeAppointmentIds?: string[];
  allowUnbookableDate?: boolean;
  staffBooking?: boolean;
  acknowledgeScheduleConflict?: boolean;
  /** Keep the chosen start when the estimate does not fit the route. */
  allowUnfittedStart?: boolean;
}): Promise<
  | { insertion: NonNullable<ReturnType<typeof findRouteInsertionAtHour>> }
  | ScheduleError
  | { error: "slot_unavailable" }
  | { error: "schedule_conflict"; message: string }
> {
  if (
    !input.allowUnbookableDate &&
    !(input.staffBooking ? isStaffBookingDate(input.date) : isDateBookable(parseDateValue(input.date)))
  ) {
    return { error: "slot_unavailable" as const };
  }

  if (!input.allowUnbookableDate && !isBookingStartInFuture(input.date, input.slotStartMinutes)) {
    return { error: "slot_unavailable" as const };
  }

  const [plansResult, closuresResult, blocksResult] = await Promise.all([
    loadDayPlans(input.date, input.date),
    loadDayClosures(input.date, input.date),
    loadAvailabilityBlocks(input.date, input.date),
  ]);
  if ("error" in plansResult) return plansResult;
  if ("error" in closuresResult) return closuresResult;
  if ("error" in blocksResult) {
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }

  const closure = closuresResult.closures.get(input.date) ?? null;
  if (
    isSlotClosed(closure, input.slotStartMinutes) ||
    appointmentOverlapsBlocks(
      blocksResult.blocks,
      input.slotStartMinutes,
      input.allowUnfittedStart ? 1 : input.durationMinutes,
    )
  ) {
    return { error: "slot_unavailable" as const };
  }

  const occupied = await loadOccupiedStops(input.date, {
    excludeAppointmentIds: input.excludeAppointmentIds,
  });
  if ("error" in occupied) return occupied;

  const stored = plansResult.plans.get(input.date) ?? null;
  const plan = resolveOccupiedDayPlan(input.date, stored, occupied);
  const route = await loadRoutes(plan, input.point, occupied.stops);
  const zoneConflict = describeStaffZoneConflict(plan, input.zip, input.point, route);
  if (zoneConflict) {
    if (!input.staffBooking) return { error: "slot_unavailable" };
    if (!input.acknowledgeScheduleConflict) {
      return { error: "schedule_conflict", message: zoneConflict };
    }
  }

  if (occupied.bookedCount >= getRoutingConfig().maxAppointmentsPerDay) {
    return { error: "slot_unavailable" as const };
  }

  if (!adjacentDriveFits(occupied.stops, input.point, input.slotStartMinutes, route)) {
    return { error: "slot_unavailable" as const };
  }

  const insertion = findRouteInsertionAtHour(
    input.base,
    occupied.stops,
    input.point,
    input.durationMinutes,
    input.slotStartMinutes,
    route,
  );
  if (!insertion) {
    if (!input.allowUnfittedStart && !zoneConflict) return { error: "slot_unavailable" as const };
    return {
      insertion: {
        scheduledStart: input.slotStartMinutes,
        durationMinutes: input.durationMinutes,
        appointmentTime: formatArrivalWindow(
          input.slotStartMinutes,
          input.durationMinutes,
        ),
        usedPreference: preferenceFromStart(input.slotStartMinutes),
      },
    };
  }

  return { insertion };
}

/**
 * Full visit fit using the same closure, block, hour, and occupied-stop
 * rules as booking. An existing visit does not re-check the bookable-date
 * window, zone, or daily cap. A newly chosen staff slot does.
 */
export async function assertVisitScheduleAllowed(input: {
  date: string;
  visitStartMinutes: number;
  durations: number[];
  excludeAppointmentIds?: string[];
  enforceZoneAndCapacity?: boolean;
  point?: GeoPoint;
  zip?: string;
}): Promise<{ ok: true } | ScheduleError | { error: "slot_unavailable"; message: string }> {
  const [closuresResult, blocksResult, occupied] = await Promise.all([
    loadDayClosures(input.date, input.date),
    loadAvailabilityBlocks(input.date, input.date),
    loadOccupiedStops(input.date, {
      excludeAppointmentIds: input.excludeAppointmentIds,
    }),
  ]);
  if ("error" in closuresResult) return closuresResult;
  if ("error" in blocksResult) {
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }
  if ("error" in occupied) return occupied;

  const bounds = visitSpanFitsScheduleBounds({
    visitStartMinutes: input.visitStartMinutes,
    durations: input.durations,
    closure: closuresResult.closures.get(input.date) ?? null,
    blocks: blocksResult.blocks,
  });
  if (!bounds.ok) {
    const reasons: Record<string, string> = {
      before_open: "The visit starts before business hours.",
      after_close: "The visit would finish after business hours.",
      closure: "The selected day or start time is closed.",
      blocked: "The visit overlaps blocked calendar time.",
    };
    return { error: "slot_unavailable", message: reasons[bounds.reason] ?? "The visit cannot fit in the schedule." };
  }
  if (
    !visitArrivalFits({
      visitStartMinutes: input.visitStartMinutes,
      durations: input.durations,
      otherStops: occupied.stops,
    })
  ) {
    return { error: "slot_unavailable", message: "The visit overlaps another appointment or leaves insufficient travel time." };
  }

  if (input.point) {
    const route = await loadRoutes(null, input.point, occupied.stops);
    if (!adjacentDriveFits(occupied.stops, input.point, input.visitStartMinutes, route)) {
      return { error: "slot_unavailable", message: "The adjacent drive is over 15 minutes or could not be verified." };
    }
  }

  if (input.enforceZoneAndCapacity) {
    if (!input.point || !input.zip) return { error: "slot_unavailable", message: "The address cannot be checked against the route." };
    const plansResult = await loadDayPlans(input.date, input.date);
    if ("error" in plansResult) return plansResult;
    const plan = resolveOccupiedDayPlan(
      input.date,
      plansResult.plans.get(input.date) ?? null,
      occupied,
    );
    const route = await loadRoutes(plan, input.point, []);
    if (!addressAllowedForPlan(plan, input.zip, input.point, route)) {
      return { error: "slot_unavailable", message: "The address is outside the route area for that date." };
    }
    if (occupied.bookedCount >= getRoutingConfig().maxAppointmentsPerDay) {
      return { error: "slot_unavailable", message: "That date has reached its appointment limit." };
    }
  }

  return { ok: true };
}

export type AdminScheduleDay = {
  date: string;
  zoneId: string;
  zoneLabel: string;
  source: "staff" | "auto" | "weekly" | "open";
  appointmentCount: number;
  closure: DayClosureRecord | null;
};

export async function listAdminScheduleDays(): Promise<
  { days: AdminScheduleDay[] } | ScheduleError
> {
  const dates = getUpcomingStaffDates(40).map((day) => day.value);
  if (dates.length === 0) return { days: [] as AdminScheduleDay[] };

  const fromDate = dates[0]!;
  const toDate = dates[dates.length - 1]!;
  const [plansResult, occupiedResult, closuresResult] = await Promise.all([
    loadDayPlans(fromDate, toDate),
    loadOccupiedStopsByDate(fromDate, toDate),
    loadDayClosures(fromDate, toDate),
  ]);
  if ("error" in plansResult) return plansResult;
  if ("error" in occupiedResult) return occupiedResult;
  if ("error" in closuresResult) return closuresResult;

  const days: AdminScheduleDay[] = dates.map((date) => {
    const stored = plansResult.plans.get(date) ?? null;
    const occupied = occupiedResult.byDate.get(date);
    const plan = resolveOccupiedDayPlan(date, stored, occupied);
    const closure = closuresResult.closures.get(date) ?? null;
    if (!plan) {
      return {
        date,
        zoneId: "auto",
        zoneLabel: "Auto — first booking locks the area",
        source: "open",
        appointmentCount: occupied?.bookedCount ?? 0,
        closure,
      };
    }
    return {
      date,
      zoneId: plan.zoneId,
      zoneLabel: zoneLabel(plan.zoneId),
      source: plan.source,
      appointmentCount: occupied?.bookedCount ?? 0,
      closure,
    };
  });

  return { days };
}

export async function claimDayPlan(
  date: string,
  zip: string,
  point: GeoPoint,
  options?: { allowOutsideZone?: boolean },
): Promise<{ plan: DayPlanRecord | null } | ScheduleError | { error: "slot_unavailable"; message: string }> {
  const loaded = await loadDayPlans(date, date);
  if ("error" in loaded) return loaded;

  const occupied = await loadOccupiedStops(date);
  if ("error" in occupied) return occupied;

  let plan = resolveOccupiedDayPlan(date, loaded.plans.get(date) ?? null, occupied);
  if (!plan) {
    const inferred = planFromFirstStop(date, zip, point);
    const inserted = await upsertDayPlan(inferred, { keepExisting: true });
    if ("error" in inserted) return inserted;

    const again = await loadDayPlans(date, date);
    if ("error" in again) return again;
    plan = again.plans.get(date) ?? inferred;
  }
  const route = await loadRoutes(plan, point, []);
  const zoneConflict = describeStaffZoneConflict(plan, zip, point, route);
  if (zoneConflict && !options?.allowOutsideZone) {
    return { error: "slot_unavailable", message: zoneConflict };
  }
  return { plan };
}

export async function setStaffDayZone(
  date: string,
  zoneId: string,
): Promise<{ ok: true } | ScheduleError | { error: "conflict" }> {
  const occupied = await loadOccupiedStops(date);
  if ("error" in occupied) return occupied;

  if (zoneId === "auto") {
    if (occupied.bookedCount === 0) return deleteDayPlan(date);
    const first = occupied.stops[0];
    const point =
      first?.lat != null && first.lon != null
        ? { lat: first.lat, lon: first.lon }
        : null;
    if (!point) return deleteDayPlan(date);
    const inferred = planFromFirstStop(date, first?.zip ?? "", point);
    return upsertDayPlan(inferred);
  }

  if (existingStopsConflictWithZone(occupied.stops, zoneId)) {
    return { error: "conflict" as const };
  }

  return upsertDayPlan({
    serviceDate: date,
    zoneId,
    source: "staff",
    anchor: null,
  });
}
