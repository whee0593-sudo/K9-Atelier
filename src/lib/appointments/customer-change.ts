import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { mapAppointmentRowToRecord } from "@/lib/appointments/map";
import type { AppointmentRecord, AppointmentRow } from "@/lib/appointments/types";
import {
  changeFeeAmount,
  changeNoticeBand,
  type AppointmentChangeAction,
} from "@/lib/appointments/change-policy";
import { resolveArrivalForBooking } from "@/lib/appointments/arrival-window";
import {
  assignArrivalWindow,
  getBaseGeoPoint,
  loadOccupiedStops,
} from "@/lib/appointments/schedule";
import {
  fetchCustomerContact,
  type CustomerContact,
} from "@/lib/email/appointment-context";
import {
  notifyCustomerAppointmentChange,
  notifyStaffNewAppointment,
} from "@/lib/email/appointment-mails";
import { getOrCreateStripeCustomerId } from "@/lib/payments/service";
import { business } from "@/lib/business";
import { getStripe } from "@/lib/stripe/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import { dollarsToCents } from "@/lib/charges/money";
import type { ChargeKind, ChargeLineItem } from "@/lib/charges/types";
import { mapPetRowToRecord } from "@/lib/pets/map";
import { PET_SELECT, type PetRow } from "@/lib/pets/types";
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import { vaccinationStatusSnapshotForBooking } from "@/lib/vaccinations/booking";
import {
  allBookableServices,
  estimateServiceDurationMinutes,
  getServicePriceEstimate,
} from "@/lib/services";
import {
  scheduleVisitPetChain,
  servicePriceFromEstimatedTotal,
  snapshotServicePrice,
  visitArrivalFits,
} from "@/lib/visits/visit";
import { compactVisitChildStarts } from "@/lib/visits/compact";
import { syncVisitTravelFeeMirror } from "@/lib/visits/travel-mirror";
import { getServiceDisplayName } from "@/lib/service-display";
import type { TimePreference } from "@/lib/booking-schedule";

type ChangeRow = AppointmentRow & {
  payment_method_id: string | null;
};

const CHANGE_SELECT = `
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
  created_at,
  payment_method_id,
  visit_id,
  service_price,
  estimated_duration_minutes,
  pets ( name, breed, weight_lbs )
`;

export type ChangeQuote = {
  action: AppointmentChangeAction;
  band: ReturnType<typeof changeNoticeBand>;
  fee: number;
  estimatedTotal: number;
};

export type ChangeVisitContext = {
  lat: number | null;
  lon: number | null;
  zip: string;
  serviceId: string;
  addOnIds: string[];
};

export type ApplyAppointmentChangeInput = {
  appointmentId: string;
  action: AppointmentChangeAction;
  date?: string;
  timePreference?: TimePreference;
  slotStartMinutes?: number;
  petId?: string;
  serviceId?: string;
  removeAppointmentId?: string;
};

function asChangeRow(row: ChangeRow): AppointmentRecord {
  return mapAppointmentRowToRecord(row);
}

async function loadOwnedAppointment(
  userId: string,
  appointmentId: string,
): Promise<{ row: ChangeRow } | { error: "server" | "not_found" | "conflict" }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(CHANGE_SELECT)
    .eq("id", appointmentId)
    .eq("customer_id", userId)
    .maybeSingle();

  if (error) {
    console.error("loadOwnedAppointment failed:", error.message);
    return { error: "server" as const };
  }
  if (!data) return { error: "not_found" as const };
  const row = data as unknown as ChangeRow;
  if (row.status === "cancelled") return { error: "conflict" as const };
  return { row };
}

async function loadVisitSiblings(
  userId: string,
  row: ChangeRow,
): Promise<{ rows: ChangeRow[] } | { error: "server" }> {
  const admin = createAdminClient();
  if (!row.visit_id) {
    return { rows: [row] };
  }
  const { data, error } = await admin
    .from("appointments")
    .select(CHANGE_SELECT)
    .eq("customer_id", userId)
    .eq("visit_id", row.visit_id)
    .neq("status", "cancelled")
    .order("scheduled_start", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadVisitSiblings failed:", error.message);
    return { error: "server" as const };
  }

  const rows = (data ?? []) as unknown as ChangeRow[];
  return { rows: rows.length > 0 ? rows : [row] };
}

function rowServicePrice(row: ChangeRow) {
  if (row.service_price != null && Number.isFinite(Number(row.service_price))) {
    return Number(row.service_price);
  }
  return (
    servicePriceFromEstimatedTotal(
      row.estimated_total == null ? null : Number(row.estimated_total),
      Number(row.travel_fee ?? 0),
    ) ?? 0
  );
}

function quoteForRows(action: AppointmentChangeAction, rows: ChangeRow[]) {
  const serviceTotal = rows.reduce((sum, row) => sum + rowServicePrice(row), 0);
  const travel =
    action === "remove_dog"
      ? 0
      : rows.reduce((max, row) => Math.max(max, Number(row.travel_fee ?? 0)), 0);
  const estimatedTotal = Math.round((serviceTotal + travel) * 100) / 100;
  const first = rows[0];
  const band = first
    ? changeNoticeBand(first.appointment_date, first.scheduled_start ?? null)
    : "complimentary";
  return {
    action,
    band,
    estimatedTotal,
    fee: changeFeeAmount(action, estimatedTotal, band),
  } satisfies ChangeQuote;
}

export async function quoteAppointmentChange(
  appointmentId: string,
  action: AppointmentChangeAction,
  removeAppointmentId?: string,
): Promise<
  | {
      quote: ChangeQuote;
      appointments: AppointmentRecord[];
      visit: ChangeVisitContext;
    }
  | { error: "unauthenticated" | "not_found" | "conflict" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const loaded = await loadOwnedAppointment(user.id, appointmentId);
  if ("error" in loaded) return loaded;

  const siblings = await loadVisitSiblings(user.id, loaded.row);
  if ("error" in siblings) return siblings;

  const targetRows =
    action === "remove_dog"
      ? siblings.rows.filter(
          (row) => row.id === (removeAppointmentId ?? appointmentId),
        )
      : action === "add_dog"
        ? siblings.rows
        : siblings.rows;

  if (targetRows.length === 0) return { error: "not_found" };

  return {
    quote: quoteForRows(action, action === "add_dog" ? [] : targetRows),
    appointments: siblings.rows.map(asChangeRow),
    visit: {
      lat: loaded.row.address_lat ?? null,
      lon: loaded.row.address_lon ?? null,
      zip: loaded.row.address_zip,
      serviceId: loaded.row.service_id,
      addOnIds: loaded.row.add_on_ids ?? [],
    },
  };
}

async function resolvePaymentMethod(
  customerId: string,
  appointmentMethodId: string | null,
): Promise<{
  id: string;
  stripePaymentMethodId: string;
  brand?: string;
  last4?: string;
} | null> {
  const admin = createAdminClient();
  const query = admin
    .from("payment_methods")
    .select("id, stripe_payment_method_id, brand, last4")
    .eq("customer_id", customerId);

  const { data } = appointmentMethodId
    ? await query.eq("id", appointmentMethodId).maybeSingle()
    : await query.order("is_default", { ascending: false }).limit(1).maybeSingle();

  if (data?.id && data.stripe_payment_method_id) {
    return {
      id: data.id as string,
      stripePaymentMethodId: data.stripe_payment_method_id as string,
      brand: (data.brand as string | null) ?? undefined,
      last4: (data.last4 as string | null) ?? undefined,
    };
  }

  if (appointmentMethodId) {
    const { data: fallback } = await admin
      .from("payment_methods")
      .select("id, stripe_payment_method_id, brand, last4")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback?.id && fallback.stripe_payment_method_id) {
      return {
        id: fallback.id as string,
        stripePaymentMethodId: fallback.stripe_payment_method_id as string,
        brand: (fallback.brand as string | null) ?? undefined,
        last4: (fallback.last4 as string | null) ?? undefined,
      };
    }
  }

  return null;
}

async function chargeChangeFee(options: {
  appointment: ChangeRow;
  customerId: string;
  customerEmail: string | undefined;
  fee: number;
  action: AppointmentChangeAction;
}): Promise<
  | { ok: true; cardBrand?: string; cardLast4?: string }
  | {
      error:
        | "payment_required"
        | "misconfigured"
        | "server"
        | "payment_failed";
    }
> {
  if (options.fee <= 0) {
    return { ok: true as const, cardBrand: undefined, cardLast4: undefined };
  }

  const method = await resolvePaymentMethod(
    options.customerId,
    options.appointment.payment_method_id,
  );
  if (!method) return { error: "payment_required" as const };

  const stripe = getStripe();
  if (!stripe || !isStripeConfigured()) return { error: "misconfigured" as const };

  const stripeCustomerId = await getOrCreateStripeCustomerId(
    options.customerId,
    options.customerEmail,
  );
  if (!stripeCustomerId) return { error: "server" as const };

  const lineItems: ChargeLineItem[] = [
    {
      id: randomUUID(),
      label:
        options.action === "reschedule"
          ? "Late reschedule fee"
          : "Cancellation fee",
      amount: options.fee,
    },
  ];

  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("appointment_charges")
    .insert({
      appointment_id: options.appointment.id,
      kind: "cancellation" as ChargeKind,
      status: "pending",
      line_items: lineItems,
      subtotal: options.fee,
      tip_amount: 0,
      total: options.fee,
      created_by: options.customerId,
      payment_method_id: method.id,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("chargeChangeFee insert failed:", insertError?.message);
    return { error: "server" as const };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: dollarsToCents(options.fee),
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: method.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      description: `K9 Atelier ${options.action.replace("_", " ")} fee`,
      metadata: {
        appointment_id: options.appointment.id,
        charge_id: inserted.id,
        kind: "cancellation",
      },
    });

    await admin
      .from("appointment_charges")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        status: paymentIntent.status === "succeeded" ? "paid" : "failed",
        paid_at:
          paymentIntent.status === "succeeded"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", inserted.id);

    if (paymentIntent.status !== "succeeded") {
      return { error: "payment_failed" as const };
    }
    return {
      ok: true as const,
      cardBrand: method.brand,
      cardLast4: method.last4,
    };
  } catch (error) {
    console.error("chargeChangeFee stripe failed:", error);
    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    return { error: "payment_failed" as const };
  }
}

async function cancelRows(
  rows: ChangeRow[],
): Promise<{ ok: true } | { error: "server" }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .in(
      "id",
      rows.map((row) => row.id),
    );

  if (error) {
    console.error("cancelRows failed:", error.message);
    return { error: "server" as const };
  }
  return { ok: true as const };
}

export async function applyAppointmentChange(
  input: ApplyAppointmentChangeInput,
): Promise<
  | { ok: true; quote: ChangeQuote }
  | {
      error:
        | "unauthenticated"
        | "not_found"
        | "conflict"
        | "slot_unavailable"
        | "payment_required"
        | "payment_failed"
        | "misconfigured"
        | "server";
    }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const loaded = await loadOwnedAppointment(user.id, input.appointmentId);
  if ("error" in loaded) return loaded;

  const siblings = await loadVisitSiblings(user.id, loaded.row);
  if ("error" in siblings) return siblings;

  if (input.action === "add_dog") {
    if (!input.petId || !input.serviceId) return { error: "conflict" };
    const created = await addDogToVisit(user.id, loaded.row, input);
    if ("error" in created) return created;
    return { ok: true, quote: quoteForRows("add_dog", []) };
  }

  const targetRows =
    input.action === "remove_dog"
      ? siblings.rows.filter(
          (row) => row.id === (input.removeAppointmentId ?? input.appointmentId),
        )
      : siblings.rows;

  if (targetRows.length === 0) return { error: "not_found" };
  if (input.action === "remove_dog" && siblings.rows.length < 2) {
    return { error: "conflict" };
  }

  const quote = quoteForRows(input.action, targetRows);
  const contact = await fetchCustomerContact(user.id);
  const charged = await chargeChangeFee({
    appointment: targetRows[0],
    customerId: user.id,
    customerEmail: contact?.email ?? user.email,
    fee: quote.fee,
    action: input.action,
  });
  if ("error" in charged) return charged;

  if (input.action === "reschedule") {
    if (
      !input.date ||
      (input.slotStartMinutes == null && !input.timePreference)
    ) {
      return { error: "conflict" };
    }
    const slotStartMinutes =
      input.slotStartMinutes ??
      (input.timePreference === "afternoon" ? 12 * 60 : 9 * 60);
    const moved = await rescheduleRows(targetRows, input.date, slotStartMinutes);
    if ("error" in moved) return moved;
    await sendChangeConfirmationEmail({
      action: "reschedule",
      appointments: moved.appointments,
      contact,
      fee: quote.fee,
      cardBrand: charged.cardBrand,
      cardLast4: charged.cardLast4,
    });
    return { ok: true, quote };
  }

  const remainingAppointments =
    input.action === "remove_dog"
      ? recordsFromRows(
          siblings.rows.filter(
            (row) => !targetRows.some((target) => target.id === row.id),
          ),
        )
      : [];
  const cancelled = await cancelRows(targetRows);
  if ("error" in cancelled) return cancelled;
  if (loaded.row.visit_id) {
    const mirrored = await syncVisitTravelFeeMirror(loaded.row.visit_id);
    if ("error" in mirrored) return mirrored;
  }
  if (input.action === "remove_dog" && loaded.row.visit_id) {
    const compacted = await compactVisitChildStarts(loaded.row.visit_id);
    if ("error" in compacted) return compacted;
  }
  await sendChangeConfirmationEmail({
    action: input.action === "remove_dog" ? "remove_dog" : "cancel",
    appointments: recordsFromRows(targetRows),
    remainingAppointments,
    contact,
    fee: quote.fee,
    cardBrand: charged.cardBrand,
    cardLast4: charged.cardLast4,
  });
  return { ok: true, quote };
}

function recordsFromRows(rows: ChangeRow[]): AppointmentRecord[] {
  return rows.map((row) =>
    mapAppointmentRowToRecord(row as unknown as AppointmentRow),
  );
}

async function sendChangeConfirmationEmail({
  action,
  appointments,
  remainingAppointments = [],
  contact,
  fee,
  cardBrand,
  cardLast4,
}: {
  action: AppointmentChangeAction;
  appointments: AppointmentRecord[];
  remainingAppointments?: AppointmentRecord[];
  contact: CustomerContact | null;
  fee: number;
  cardBrand?: string;
  cardLast4?: string;
}) {
  const appointment = appointments[0];
  if (!appointment || !contact) return;
  try {
    await notifyCustomerAppointmentChange(action, appointment, contact, {
      petNames: appointments.map((row) => row.petName),
      serviceLabels: appointments.map(
        (row) => `${row.petName} · ${row.serviceName}`,
      ),
      remainingAppointments,
      manageAppointmentId: remainingAppointments[0]?.id,
      fee,
      feeStatus: fee > 0 ? "paid" : "none",
      cardBrand,
      cardLast4,
    });
  } catch (emailError) {
    console.error("appointment change email failed:", emailError);
  }
}

function durationMinutesForRow(row: ChangeRow) {
  if (
    typeof row.estimated_duration_minutes === "number" &&
    row.estimated_duration_minutes > 0
  ) {
    return row.estimated_duration_minutes;
  }
  const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
  return estimateServiceDurationMinutes(
    row.service_id,
    pet?.weight_lbs ?? 20,
    row.add_on_ids ?? [],
  );
}

async function writeVisitSchedule(
  rows: Array<{
    id: string;
    appointmentTime: string | null;
    scheduledStart: number;
    timePreference: "morning" | "afternoon" | null;
    date: string;
    durationMinutes: number;
  }>,
): Promise<{ ok: true } | { error: "server" | "slot_unavailable" }> {
  const admin = createAdminClient();
  const ids = rows.map((row) => row.id);
  const { error: clearError } = await admin
    .from("appointments")
    .update({ scheduled_start: null })
    .in("id", ids);
  if (clearError) {
    console.error("writeVisitSchedule clear failed:", clearError.message);
    return { error: "server" };
  }

  for (const row of rows) {
    const { error } = await admin
      .from("appointments")
      .update({
        appointment_date: row.date,
        appointment_time: row.appointmentTime,
        scheduled_start: row.scheduledStart,
        time_preference: row.timePreference,
        estimated_duration_minutes: row.durationMinutes,
      })
      .eq("id", row.id);
    if (error) {
      console.error("writeVisitSchedule update failed:", error.message);
      if (error.code === "23505") return { error: "slot_unavailable" };
      return { error: "server" };
    }
  }
  return { ok: true };
}

async function rescheduleRows(
  rows: ChangeRow[],
  date: string,
  slotStartMinutes: number,
): Promise<
  | { appointments: AppointmentRecord[] }
  | { error: "server" | "slot_unavailable" }
> {
  const ordered = [...rows].sort(
    (left, right) =>
      (left.scheduled_start ?? 0) - (right.scheduled_start ?? 0) ||
      left.created_at.localeCompare(right.created_at),
  );
  const first = ordered[0];
  if (!first) return { error: "server" };
  if (first.address_lat == null || first.address_lon == null) {
    return { error: "server" as const };
  }

  const durations = ordered.map(durationMinutesForRow);
  const totalDuration = durations.reduce((sum, minutes) => sum + minutes, 0);
  const base = await getBaseGeoPoint();
  const assignment = base
    ? await assignArrivalWindow({
        date,
        point: { lat: first.address_lat, lon: first.address_lon },
        zip: first.address_zip,
        durationMinutes: totalDuration,
        slotStartMinutes,
        base,
        excludeAppointmentIds: ordered.map((entry) => entry.id),
      })
    : { error: "misconfigured" as const };
  const schedule = resolveArrivalForBooking(assignment, slotStartMinutes);
  if ("error" in schedule) return { error: "slot_unavailable" as const };

  const planned = scheduleVisitPetChain({
    visitStartMinutes: schedule.scheduledStart,
    durations,
  });
  if (!planned.ok) return { error: "slot_unavailable" as const };
  const chained = ordered.map((row, index) => ({
    id: row.id,
    appointmentTime: planned.slots[index]!.appointmentTime,
    scheduledStart: planned.slots[index]!.scheduledStart,
    timePreference: planned.slots[index]!.usedPreference,
    date,
    durationMinutes: planned.slots[index]!.durationMinutes,
  }));

  const written = await writeVisitSchedule(chained);
  if ("error" in written) return written;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(CHANGE_SELECT)
    .in(
      "id",
      chained.map((row) => row.id),
    );
  if (error || !data) {
    console.error("rescheduleRows reload failed:", error?.message);
    return { error: "server" };
  }
  const byId = new Map(
    (data as unknown as ChangeRow[]).map((row) => [row.id, row]),
  );
  return {
    appointments: chained.map((row) =>
      mapAppointmentRowToRecord(byId.get(row.id) as AppointmentRow),
    ),
  };
}

async function addDogToVisit(
  userId: string,
  visit: ChangeRow,
  input: ApplyAppointmentChangeInput,
): Promise<
  | { appointment: AppointmentRecord }
  | {
      error:
        | "conflict"
        | "server"
        | "not_found"
        | "payment_required"
        | "slot_unavailable";
    }
> {
  if (!input.petId || !input.serviceId) return { error: "conflict" as const };
  if (visit.address_lat == null || visit.address_lon == null) {
    return { error: "server" as const };
  }

  const admin = createAdminClient();
  const { data: petRow, error: petError } = await admin
    .from("pets")
    .select(PET_SELECT)
    .eq("id", input.petId)
    .eq("customer_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) {
    console.error("addDogToVisit pet failed:", petError.message);
    return { error: "server" as const };
  }
  if (!petRow) return { error: "not_found" as const };

  let pet = mapPetRowToRecord(petRow as PetRow);
  try {
    const [enriched] = await attachVaccinationSummaries([pet]);
    if (enriched) pet = enriched;
  } catch (vaccinationError) {
    console.error("addDogToVisit vaccination summary failed:", vaccinationError);
  }

  const service = allBookableServices().find((entry) => entry.id === input.serviceId);
  if (!service) return { error: "conflict" as const };

  const estimate = getServicePriceEstimate(service, pet.weightLbs);
  const paymentMethod = await resolvePaymentMethod(
    userId,
    visit.payment_method_id,
  );
  if (!paymentMethod) return { error: "payment_required" as const };
  if (!visit.visit_id) return { error: "server" as const };

  const family = await loadVisitSiblings(userId, visit);
  if ("error" in family) return family;
  const ordered = [...family.rows].sort(
    (left, right) =>
      (left.scheduled_start ?? 0) - (right.scheduled_start ?? 0) ||
      left.created_at.localeCompare(right.created_at),
  );
  const starts = ordered
    .map((row) => row.scheduled_start)
    .filter((value): value is number => typeof value === "number");
  if (starts.length === 0) return { error: "slot_unavailable" as const };
  const visitStart = Math.min(...starts);

  const durationMinutes = estimateServiceDurationMinutes(
    service.id,
    pet.weightLbs,
    [],
  );
  const durations = [...ordered.map(durationMinutesForRow), durationMinutes];
  const occupied = await loadOccupiedStops(visit.appointment_date, {
    excludeAppointmentIds: ordered.map((row) => row.id),
  });
  if ("error" in occupied) return { error: "server" as const };
  if (
    !visitArrivalFits({
      visitStartMinutes: visitStart,
      durations,
      otherStops: occupied.stops,
    })
  ) {
    return { error: "slot_unavailable" as const };
  }
  const planned = scheduleVisitPetChain({
    visitStartMinutes: visitStart,
    durations,
  });
  const schedule = planned.ok ? planned.slots[planned.slots.length - 1] : null;
  if (!schedule) return { error: "slot_unavailable" as const };

  const vaccinationStatus = vaccinationStatusSnapshotForBooking(pet);
  const status = "confirmed";
  const servicePrice = snapshotServicePrice(estimate?.from ?? 0);

  const { data, error } = await admin
    .from("appointments")
    .insert({
      customer_id: userId,
      visit_id: visit.visit_id,
      pet_id: input.petId,
      service_id: service.id,
      service_name: getServiceDisplayName(service.id, service.name),
      add_on_ids: [],
      add_on_options: {},
      address_street: visit.address_street,
      address_city: visit.address_city,
      address_state: visit.address_state,
      address_zip: visit.address_zip,
      travel_distance_miles: Number(visit.travel_distance_miles),
      travel_fee: 0,
      service_price: servicePrice,
      estimated_duration_minutes: durationMinutes,
      appointment_date: visit.appointment_date,
      appointment_time: schedule.appointmentTime,
      scheduled_start: schedule.scheduledStart,
      time_preference: schedule.usedPreference,
      address_lat: visit.address_lat,
      address_lon: visit.address_lon,
      timezone: business.booking.timezone,
      estimated_total: servicePrice,
      new_client_deposit: 0,
      payment_method_id: paymentMethod.id,
      vaccination_status_at_booking: vaccinationStatus,
      status,
      confirmed_at: new Date().toISOString(),
    })
    .select(CHANGE_SELECT)
    .single();

  if (error || !data) {
    console.error("addDogToVisit insert failed:", error?.message);
    if (error?.code === "23505") return { error: "slot_unavailable" as const };
    return { error: "server" as const };
  }

  const appointment = mapAppointmentRowToRecord(data as unknown as AppointmentRow);
  try {
    const contact = await fetchCustomerContact(userId);
    if (contact) {
      await notifyStaffNewAppointment(appointment, contact);
      await notifyCustomerAppointmentChange("add_dog", appointment, contact);
    }
  } catch (emailError) {
    console.error("addDogToVisit email failed:", emailError);
  }

  if (visit.visit_id) {
    await compactVisitChildStarts(visit.visit_id);
  }

  return { appointment };
}
