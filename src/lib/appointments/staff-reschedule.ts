import { bookingWeightLbs, liveServiceDurationMinutes } from "@/lib/pets/weight";
import { fixedPriceForService, mapFixedServicePrices, type PetServicePriceRow } from "@/lib/pets/fixed-prices";
import { addOnSelectionMessage, getServicePriceEstimate } from "@/lib/services";
import { visitCheckoutPetFromStoredAppointment } from "@/lib/charges/stored-visit-pet";
import { readStoredVisitLineItems, VISIT_LINE_ITEMS_KEY } from "@/lib/charges/visit-line-items";
import { groupBlocksByDate } from "@/lib/appointments/availability-blocks";
import { loadAvailabilityBlocks } from "@/lib/appointments/availability-block-store";
import {
  assertVisitScheduleAllowed,
  getAvailabilityForAddress,
  getBaseGeoPoint,
  loadDayClosures,
  loadOccupiedStopsByDate,
} from "@/lib/appointments/schedule";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type {
  AdminAppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { parseStaffRescheduleInput, staffRescheduleServices } from "@/lib/appointments/staff-reschedule-input";
import { applyVisitServiceChange, replaceVisitSchedule } from "@/lib/visits/persist";
import { resolveAppointmentDuration } from "@/lib/visits/duration";
import {
  hasVisitSequence,
  listVisitArrivalMinutes,
  scheduleVisitPetChain,
  visitSpanFitsScheduleBounds,
} from "@/lib/visits/visit";
import {
  contactFromAdminAppointment,
  type CustomerContact,
} from "@/lib/email/appointment-context";
import { notifyCustomerAppointmentChange } from "@/lib/email/appointment-mails";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

const STAFF_RESCHEDULE_SELECT = `
  id,
  customer_id,
  pet_id,
  service_id,
  service_name,
  add_on_ids,
  add_on_options,
  address_street,
  address_city,
  address_state,
  address_zip,
  travel_distance_miles,
  travel_fee,
  appointment_date,
  appointment_time,
  scheduled_start,
  time_preference,
  address_lat,
  address_lon,
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  customer_confirmed_at,
  staff_created,
  customer_confirm_token_hash,
  customer_confirm_expires_at,
  visit_id,
  visit_sequence,
  service_price,
  estimated_duration_minutes,
  created_at,
  reminder_sms_sent_at,
  en_route_sms_sent_at,
  service_started_at,
  service_ended_at,
  pets ( name, breed, weight_lbs, pet_service_prices ( service_id, amount ) ),
  visits ( service_started_at, service_ended_at ),
  profiles ( email, first_name, last_name, phone )
`;

type StaffRescheduleError =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "slot_unavailable"
  | "invalid_service"
  | "misconfigured"
  | "server";

type LoadedPet = { name: string; breed: string; weight_lbs?: number; pet_service_prices?: PetServicePriceRow[] };

type LoadedAppointment = Omit<AppointmentRow, "pets"> & {
  address_lat?: number | null;
  address_lon?: number | null;
  pets?: LoadedPet | LoadedPet[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function requireStaffSession(): Promise<
  { ok: true } | { error: "unauthenticated" | "forbidden" }
> {
  try {
    const { getStaffSession } = await import("@/lib/staff/auth");
    const session = await getStaffSession();
    if ("error" in session) return { error: session.error };
    return { ok: true };
  } catch (error) {
    console.error("staff reschedule auth failed:", error);
    return { error: "unauthenticated" };
  }
}

async function loadAppointmentRow(
  appointmentId: string,
): Promise<{ row: LoadedAppointment } | { error: StaffRescheduleError }> {
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(STAFF_RESCHEDULE_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("loadStaffRescheduleAppointment failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };
  return { row: data as unknown as LoadedAppointment };
}

function visitPoint(row: LoadedAppointment): { lat: number; lon: number } | null {
  if (
    typeof row.address_lat !== "number" ||
    typeof row.address_lon !== "number"
  ) {
    return null;
  }
  return { lat: row.address_lat, lon: row.address_lon };
}

function visitDurationDecision(row: LoadedAppointment) {
  const pet = firstRelation(row.pets);
  return resolveAppointmentDuration({
    storedMinutes: row.estimated_duration_minutes,
    status: row.status,
    appointmentDate: row.appointment_date,
    serviceEndedAt: row.service_ended_at,
    liveEstimateMinutes:
      liveServiceDurationMinutes(
        row.service_id,
        pet?.weight_lbs,
        row.add_on_ids ?? [],
      ) ?? 0,
  });
}

function assertOpenForReschedule(
  row: LoadedAppointment,
): { error: StaffRescheduleError } | null {
  if (row.status === "cancelled") return { error: "conflict" };
  if (
    row.status !== "confirmed" &&
    row.status !== "pending_confirmation"
  ) {
    return { error: "conflict" };
  }
  return null;
}

function isCompletedVisit(row: LoadedAppointment) {
  const visit = Array.isArray(row.visits) ? row.visits[0] : row.visits;
  return Boolean(visit?.service_started_at || visit?.service_ended_at || row.service_started_at || row.service_ended_at);
}

type PlannedServiceEdit = NonNullable<Parameters<typeof applyVisitServiceChange>[0]["service"]> & {
  durationMinutes: number;
};

function planServiceEdit(row: LoadedAppointment, serviceId: string | undefined):
  | { service: PlannedServiceEdit | null }
  | { error: "invalid_service"; message?: string } {
  if (!serviceId || serviceId === row.service_id) return { service: null };
  if (isCompletedVisit(row)) {
    return { error: "invalid_service", message: "The service can only be changed before the visit starts." } as const;
  }
  const pet = firstRelation(row.pets);
  const weight = bookingWeightLbs(pet?.weight_lbs);
  const service = staffRescheduleServices(weight).find((item) => item.id === serviceId);
  if (!service || weight == null) return { error: "invalid_service" } as const;
  const addOnIds = row.add_on_ids ?? [];
  const message = addOnSelectionMessage([serviceId], addOnIds);
  if (message) return { error: "invalid_service", message } as const;
  const price = fixedPriceForService(mapFixedServicePrices(pet?.pet_service_prices), serviceId)
    ?? getServicePriceEstimate(service, weight)?.from;
  const durationMinutes = liveServiceDurationMinutes(serviceId, weight, addOnIds);
  if (price == null || !durationMinutes) return { error: "invalid_service" } as const;
  const addOnOptions: Record<string, unknown> = { ...row.add_on_options };
  const checkout = visitCheckoutPetFromStoredAppointment({
    id: row.id,
    status: row.status,
    serviceName: row.service_name,
    serviceId: row.service_id,
    servicePrice: row.service_price ?? null,
    serviceEndedAt: null,
    addOnIds,
    addOnOptions,
    petName: pet?.name ?? "Dog",
    weightLbs: weight,
  });
  if (checkout.priceReviewRequired) {
    return { error: "invalid_service", message: "Review this pet's existing service and add-on prices before changing the service." } as const;
  }
  delete addOnOptions[row.service_id];
  const stored = readStoredVisitLineItems(addOnOptions);
  if (stored) {
    const primary = stored.findIndex((line) => line.catalogId !== "travel-fee" && line.catalogId !== "no-show");
    if (primary >= 0) {
      stored[primary] = {
        ...stored[primary]!,
        catalogId: serviceId,
        label: service.name,
        amount: price,
        listAmount: price,
      };
      addOnOptions[VISIT_LINE_ITEMS_KEY] = stored;
    }
  }
  const travelFee = Number(row.travel_fee ?? 0);
  const estimatedTotal = price + travelFee +
    (checkout.addOns ?? []).reduce((sum, item) => sum + item.amount, 0);
  return {
    service: {
      serviceId,
      serviceName: service.name,
      addOnIds,
      addOnOptions,
      travelFee,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      durationMinutes,
      servicePrice: price,
      previous: { serviceId: row.service_id, date: row.appointment_date, start: row.scheduled_start ?? null },
    },
  };
}

export async function listStaffAppointmentAvailability(
  appointmentId: string,
  serviceId?: string,
): Promise<
  | {
      days: Array<{ date: string; available: boolean; slots: number[] }>;
      visit: {
        dogCount: number;
        estimatedDurationMinutes: number;
        dogs: Array<{
          petName: string;
          serviceName: string;
          durationMinutes: number;
        }>;
      };
    }
  | { error: StaffRescheduleError; message?: string }
> {
  const session = await requireStaffSession();
  if ("error" in session) return session;

  const loaded = await loadAppointmentRow(appointmentId);
  if ("error" in loaded) return loaded;

  const blocked = assertOpenForReschedule(loaded.row);
  if (blocked) return blocked;
  const serviceEdit = planServiceEdit(loaded.row, serviceId);
  if ("error" in serviceEdit) return serviceEdit;

  const point = visitPoint(loaded.row);
  if (!point) return { error: "conflict" };

  const base = await getBaseGeoPoint();
  if (!base) return { error: "misconfigured" };

  const today = todayInBusinessTimezone();
  const extraDates = [today, loaded.row.appointment_date].filter(
    (date, index, all) =>
      Boolean(date) &&
      all.indexOf(date) === index,
  );
  const visitRows = [...(await loadActiveVisitRows(loaded.row))].sort(
    (left, right) => (left.visit_sequence ?? 0) - (right.visit_sequence ?? 0),
  );
  if (visitRows.some((row) => !hasVisitSequence(row.visit_sequence))) {
    return { error: "conflict" };
  }
  const visitAppointmentIds = visitRows.map((row) => row.id);
  const durations = visitRows.map((row) =>
    row.id === appointmentId && serviceEdit.service
      ? serviceEdit.service.durationMinutes
      : visitDurationDecision(row).minutes,
  );
  if (durations.some((duration) => duration == null)) {
    return { error: "conflict" };
  }
  const knownDurations = durations.map((duration) => duration ?? 0);
  const totalDuration = knownDurations.reduce((sum, minutes) => sum + minutes, 0);
  const result = await getAvailabilityForAddress({
    point,
    zip: loaded.row.address_zip,
    durationMinutes: 30,
    base,
    excludeAppointmentIds: visitAppointmentIds,
    extraDates,
    staffBooking: true,
  });
  if ("error" in result) return result;

  const dates = result.days.map((day) => day.date);
  const fromDate = dates[0];
  const toDate = dates[dates.length - 1];
  const [occupiedResult, closuresResult, blocksResult] = await Promise.all([
    fromDate && toDate
      ? loadOccupiedStopsByDate(fromDate, toDate, {
          excludeAppointmentIds: visitAppointmentIds,
        })
      : Promise.resolve({ byDate: new Map() }),
    fromDate && toDate
      ? loadDayClosures(fromDate, toDate)
      : Promise.resolve({ closures: new Map() }),
    fromDate && toDate
      ? loadAvailabilityBlocks(fromDate, toDate)
      : Promise.resolve({ blocks: [] }),
  ]);
  if ("error" in occupiedResult) return occupiedResult;
  if ("error" in closuresResult) return closuresResult;
  if ("error" in blocksResult) {
    return {
      error: blocksResult.error === "misconfigured" ? "misconfigured" : "server",
    };
  }
  const blocksByDate = groupBlocksByDate(blocksResult.blocks);

  const days = result.days.map((day) => {
    if (!day.available && day.slots.length === 0) return day;
    const closure = closuresResult.closures.get(day.date) ?? null;
    const dayBlocks = blocksByDate.get(day.date) ?? [];
    if (closure?.closedAllDay || dayBlocks.some((block) => block.allDay)) {
      return { date: day.date, available: false, slots: [] as number[] };
    }
    const stops = occupiedResult.byDate.get(day.date)?.stops ?? [];
    const slots = listVisitArrivalMinutes({
      durations: knownDurations,
      otherStops: stops,
    }).filter(
      (start) =>
        visitSpanFitsScheduleBounds({
          visitStartMinutes: start,
          durations: knownDurations,
          closure,
          blocks: dayBlocks,
        }).ok,
    );
    return { date: day.date, available: slots.length > 0, slots };
  });

  return {
    days,
    visit: {
      dogCount: visitRows.length,
      estimatedDurationMinutes: totalDuration,
      dogs: visitRows.map((row, index) => ({
        petName: firstRelation(row.pets)?.name ?? "Dog",
        serviceName: row.id === appointmentId && serviceEdit.service
          ? serviceEdit.service.serviceName
          : row.service_name,
        durationMinutes: knownDurations[index] ?? 0,
      })),
    },
  };
}

export async function rescheduleStaffAppointment(
  appointmentId: string,
  date: string | undefined,
  slotStartMinutes: number | undefined,
  serviceId?: string,
  acknowledgedConflict?: string,
): Promise<
  | { appointment: AdminAppointmentRecord }
  | { error: StaffRescheduleError | "schedule_conflict"; message?: string }
> {
  const session = await requireStaffSession();
  if ("error" in session) return session;

  const requestedTime = date !== undefined || slotStartMinutes !== undefined;
  if (requestedTime && "error" in parseStaffRescheduleInput({ date, slotStartMinutes })) {
    return { error: "conflict" };
  }

  const loaded = await loadAppointmentRow(appointmentId);
  if ("error" in loaded) return loaded;

  const blocked = assertOpenForReschedule(loaded.row);
  if (blocked) return blocked;

  const ordered = [...(await loadActiveVisitRows(loaded.row))].sort(
    (left, right) => (left.visit_sequence ?? 0) - (right.visit_sequence ?? 0),
  );
  if (ordered.some((row) => !hasVisitSequence(row.visit_sequence))) {
    return { error: "conflict" };
  }
  const anchor = ordered[0] ?? loaded.row;
  const serviceEdit = planServiceEdit(loaded.row, serviceId);
  if ("error" in serviceEdit) return serviceEdit;
  const { service } = serviceEdit;
  const scheduleDate = date ?? anchor.appointment_date;
  const scheduleStart = slotStartMinutes ?? anchor.scheduled_start;
  const timeChanged = scheduleDate !== anchor.appointment_date || scheduleStart !== anchor.scheduled_start;
  if (!timeChanged && !service) {
    return { appointment: mapAppointmentRowToAdminRecord(loaded.row as AppointmentRow) };
  }
  if (scheduleStart == null) return { error: "slot_unavailable" };
  const visitAppointmentIds = ordered.map((row) => row.id);
  const estimatedDurations = ordered.map((row) =>
    row.id === appointmentId && service ? service.durationMinutes : visitDurationDecision(row).minutes,
  );
  if (estimatedDurations.some((duration) => duration == null)) {
    return { error: "conflict" };
  }
  const durations = estimatedDurations.map((duration) => duration ?? 0);
  const completed = ordered.some(isCompletedVisit);
  if (completed && service) return { error: "invalid_service" };
  const planned = scheduleVisitPetChain({
    visitStartMinutes: scheduleStart,
    durations,
  });
  if (!planned.ok) return { error: "slot_unavailable" };
  const slots = planned.slots;

  if (!completed) {
    const point = visitPoint(anchor);
    if (!point && timeChanged) return { error: "conflict" };
    const allowed = await assertVisitScheduleAllowed({
      date: scheduleDate,
      visitStartMinutes: scheduleStart,
      durations,
      excludeAppointmentIds: visitAppointmentIds,
      enforceZoneAndCapacity: timeChanged,
      point: point ?? undefined,
      zip: anchor.address_zip,
    });
    if ("error" in allowed) {
      if (allowed.error !== "slot_unavailable") return allowed;
      if (allowed.message !== acknowledgedConflict) {
        return { error: "schedule_conflict", message: allowed.message };
      }
      const { getOwnerSession } = await import("@/lib/staff/auth");
      const owner = await getOwnerSession();
      if ("error" in owner) return { error: owner.error };
    }
  }

  const visitId = ordered[0]?.visit_id;
  if (!visitId) return { error: "server" };
  const schedule = {
    serviceDate: scheduleDate,
    visitStartMinutes: slots[0]!.scheduledStart,
    timePreference: slots[0]!.usedPreference,
    children: ordered.map((row, index) => {
      const slot = slots[index]!;
      return {
        id: row.id,
        scheduledStart: slot.scheduledStart,
        durationMinutes: slot.durationMinutes,
        appointmentTime: slot.appointmentTime,
        timePreference: slot.usedPreference,
      };
    }),
  };
  const written = service
    ? await applyVisitServiceChange({ appointmentId, visitId, service, schedule })
    : await replaceVisitSchedule({ visitId, ...schedule });
  if ("error" in written) return written;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("appointments")
    .select(STAFF_RESCHEDULE_SELECT)
    .eq("id", appointmentId)
    .single();

  if (error || !data) {
    console.error("rescheduleStaffAppointment reload failed:", error?.message);
    return { error: "server" };
  }

  const appointment = mapAppointmentRowToAdminRecord(
    data as unknown as AppointmentRow,
  );
  if (!completed && timeChanged) {
    const contact: CustomerContact | null =
      contactFromAdminAppointment(appointment);
    if (contact) {
      try {
        await notifyCustomerAppointmentChange(
          "reschedule",
          appointment,
          contact,
          {
            fee: 0,
            petNames: ordered.map((row) => {
              const pet = firstRelation(row.pets);
              return pet?.name ?? "Dog";
            }),
          },
        );
      } catch (emailError) {
        console.error("staff reschedule email failed:", emailError);
      }
    }
  }

  return { appointment };
}

async function loadActiveVisitRows(row: LoadedAppointment) {
  if (!row.visit_id) return [row];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(STAFF_RESCHEDULE_SELECT)
    .eq("visit_id", row.visit_id)
    .neq("status", "cancelled")
    .order("visit_sequence", { ascending: true });
  if (error || !data?.length) {
    if (error) console.error("loadActiveVisitRows failed:", error.message);
    return [row];
  }
  return data as unknown as LoadedAppointment[];
}
