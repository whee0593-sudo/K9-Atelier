import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { getBaseAddressFormatted } from "@/lib/server/base-address";
import { geocodeBaseAddress } from "@/lib/geo";
import {
  addressAllowedForPlan,
  existingStopsConflictWithZone,
  findRouteInsertion,
  getRoutingConfig,
  listCalendarDates,
  planFromFirstStop,
  preferenceAvailability,
  resolveEffectivePlan,
  zoneLabel,
  type DayPlanRecord,
  type GeoPoint,
  type RouteStop,
  type TimePreference,
} from "@/lib/booking-schedule";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";

export type OccupiedAppointment = RouteStop & {
  zip: string | null;
};

type ScheduleError = { error: "misconfigured" | "server" };
type OccupiedDay = { stops: OccupiedAppointment[]; bookedCount: number };

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function requireAdminClient() {
  if (!hasSupabaseAdminConfig()) return null;
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
  if (!admin) return { error: "misconfigured" as const };

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

type OccupiedRow = {
  appointment_date: string;
  address_lat: number | null;
  address_lon: number | null;
  scheduled_start: number | null;
  service_id: string;
  add_on_ids: string[] | null;
  address_zip: string | null;
  pets: { weight_lbs?: number } | { weight_lbs?: number }[] | null;
};

function mapOccupiedRow(row: OccupiedRow): OccupiedAppointment | null {
  const pet = firstRelation(row.pets);
  const weightLbs = pet?.weight_lbs ?? 20;
  const scheduledStart =
    typeof row.scheduled_start === "number" ? row.scheduled_start : null;
  if (scheduledStart == null) return null;
  return {
    lat: typeof row.address_lat === "number" ? row.address_lat : null,
    lon: typeof row.address_lon === "number" ? row.address_lon : null,
    zip: typeof row.address_zip === "string" ? row.address_zip : null,
    scheduledStart,
    durationMinutes: estimateServiceDurationMinutes(
      String(row.service_id),
      weightLbs,
      Array.isArray(row.add_on_ids)
        ? row.add_on_ids.filter((id): id is string => typeof id === "string")
        : [],
    ),
  };
}

export async function loadOccupiedStopsByDate(
  fromDate: string,
  toDate: string,
): Promise<{ byDate: Map<string, OccupiedDay> } | ScheduleError> {
  const admin = requireAdminClient();
  if (!admin) return { error: "misconfigured" as const };

  const { data, error } = await admin
    .from("appointments")
    .select(
      "appointment_date, address_lat, address_lon, scheduled_start, service_id, add_on_ids, address_zip, pets ( weight_lbs )",
    )
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .neq("status", "cancelled");

  if (error) {
    console.error("loadOccupiedStopsByDate failed:", error.message);
    return { error: "server" as const };
  }

  const byDate = new Map<string, { stops: OccupiedAppointment[]; bookedCount: number }>();
  for (const row of (data ?? []) as OccupiedRow[]) {
    const current = byDate.get(row.appointment_date) ?? {
      stops: [],
      bookedCount: 0,
    };
    current.bookedCount += 1;
    const stop = mapOccupiedRow(row);
    if (stop) current.stops.push(stop);
    byDate.set(row.appointment_date, current);
  }

  for (const entry of byDate.values()) {
    entry.stops.sort((a, b) => a.scheduledStart - b.scheduledStart);
  }

  return { byDate };
}

export async function loadOccupiedStops(
  dateValue: string,
): Promise<OccupiedDay | ScheduleError> {
  const result = await loadOccupiedStopsByDate(dateValue, dateValue);
  if ("error" in result) return result;
  return result.byDate.get(dateValue) ?? { stops: [], bookedCount: 0 };
}

export async function upsertDayPlan(plan: {
  serviceDate: string;
  zoneId: string;
  source: "staff" | "auto";
  anchor: GeoPoint | null;
}): Promise<{ ok: true } | ScheduleError> {
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
    { onConflict: "service_date" },
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

export async function getAvailabilityForAddress(input: {
  point: GeoPoint;
  zip: string;
  durationMinutes: number;
  base: GeoPoint;
}): Promise<
  | {
      days: Array<{
        date: string;
        available: boolean;
        morning: boolean;
        afternoon: boolean;
      }>;
    }
  | ScheduleError
> {
  const dates = listCalendarDates(40);
  if (dates.length === 0) return { days: [] };

  const fromDate = dates[0]!;
  const toDate = dates[dates.length - 1]!;
  const [plansResult, occupiedResult] = await Promise.all([
    loadDayPlans(fromDate, toDate),
    loadOccupiedStopsByDate(fromDate, toDate),
  ]);
  if ("error" in plansResult) return plansResult;
  if ("error" in occupiedResult) return occupiedResult;

  const days = [];
  for (const date of dates) {
    if (!isDateBookable(parseDateValue(date))) {
      days.push({
        date,
        available: false,
        morning: false,
        afternoon: false,
      });
      continue;
    }

    const occupied = occupiedResult.byDate.get(date) ?? {
      stops: [],
      bookedCount: 0,
    };

    const plan = resolveEffectivePlan(date, plansResult.plans.get(date) ?? null);
    const inZone = addressAllowedForPlan(plan, input.zip, input.point);
    if (!inZone) {
      days.push({ date, available: false, morning: false, afternoon: false });
      continue;
    }

    const max = getRoutingConfig().maxAppointmentsPerDay;
    if (occupied.bookedCount >= max) {
      days.push({ date, available: false, morning: false, afternoon: false });
      continue;
    }

    const flags = preferenceAvailability(
      input.base,
      occupied.stops,
      input.point,
      input.durationMinutes,
    );
    days.push({
      date,
      available: flags.morning || flags.afternoon,
      morning: flags.morning,
      afternoon: flags.afternoon,
    });
  }

  return { days };
}

export async function assignArrivalWindow(input: {
  date: string;
  point: GeoPoint;
  zip: string;
  durationMinutes: number;
  preference: TimePreference;
  base: GeoPoint;
}): Promise<
  | { insertion: NonNullable<ReturnType<typeof findRouteInsertion>> }
  | ScheduleError
  | { error: "slot_unavailable" }
> {
  if (!isDateBookable(parseDateValue(input.date))) {
    return { error: "slot_unavailable" as const };
  }

  const plansResult = await loadDayPlans(input.date, input.date);
  if ("error" in plansResult) return plansResult;

  const occupied = await loadOccupiedStops(input.date);
  if ("error" in occupied) return occupied;

  const stored = plansResult.plans.get(input.date) ?? null;
  const plan = resolveEffectivePlan(input.date, stored);
  if (!addressAllowedForPlan(plan, input.zip, input.point)) {
    return { error: "slot_unavailable" as const };
  }

  if (occupied.bookedCount >= getRoutingConfig().maxAppointmentsPerDay) {
    return { error: "slot_unavailable" as const };
  }

  const insertion = findRouteInsertion(
    input.base,
    occupied.stops,
    input.point,
    input.durationMinutes,
    input.preference,
  );
  if (!insertion) return { error: "slot_unavailable" as const };

  return { insertion };
}

export type AdminScheduleDay = {
  date: string;
  zoneId: string;
  zoneLabel: string;
  source: "staff" | "auto" | "weekly" | "open";
  appointmentCount: number;
};

export async function listAdminScheduleDays(): Promise<
  { days: AdminScheduleDay[] } | ScheduleError
> {
  const dates = listCalendarDates(40);
  if (dates.length === 0) return { days: [] as AdminScheduleDay[] };

  const fromDate = dates[0]!;
  const toDate = dates[dates.length - 1]!;
  const [plansResult, occupiedResult] = await Promise.all([
    loadDayPlans(fromDate, toDate),
    loadOccupiedStopsByDate(fromDate, toDate),
  ]);
  if ("error" in plansResult) return plansResult;
  if ("error" in occupiedResult) return occupiedResult;

  const days: AdminScheduleDay[] = dates.map((date) => {
    const stored = plansResult.plans.get(date) ?? null;
    const plan = resolveEffectivePlan(date, stored);
    const occupied = occupiedResult.byDate.get(date);
    if (!plan) {
      return {
        date,
        zoneId: "auto",
        zoneLabel: "Auto — first booking locks the area",
        source: "open",
        appointmentCount: occupied?.bookedCount ?? 0,
      };
    }
    return {
      date,
      zoneId: plan.zoneId,
      zoneLabel: zoneLabel(plan.zoneId),
      source: plan.source,
      appointmentCount: occupied?.bookedCount ?? 0,
    };
  });

  return { days };
}

export async function claimDayPlan(
  date: string,
  zip: string,
  point: GeoPoint,
): Promise<{ plan: DayPlanRecord | null } | ScheduleError | { error: "slot_unavailable" }> {
  const loaded = await loadDayPlans(date, date);
  if ("error" in loaded) return loaded;

  const stored = loaded.plans.get(date) ?? null;
  const effective = resolveEffectivePlan(date, stored);
  if (effective) {
    if (!addressAllowedForPlan(effective, zip, point)) {
      return { error: "slot_unavailable" };
    }
    return { plan: effective };
  }

  const inferred = planFromFirstStop(date, zip, point);
  const inserted = await upsertDayPlan(inferred);
  if ("error" in inserted) return inserted;

  const again = await loadDayPlans(date, date);
  if ("error" in again) return again;
  const plan = again.plans.get(date) ?? inferred;
  if (!addressAllowedForPlan(plan, zip, point)) {
    return { error: "slot_unavailable" };
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
