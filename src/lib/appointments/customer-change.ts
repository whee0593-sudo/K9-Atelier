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
import { assignArrivalWindow, getBaseGeoPoint } from "@/lib/appointments/schedule";
import { fetchCustomerContact } from "@/lib/email/appointment-context";
import { getOrCreateStripeCustomerId } from "@/lib/payments/service";
import { business } from "@/lib/business";
import {
  sendAppointmentCreatedEmails,
} from "@/lib/email/appointment-mails";
import { getStripe } from "@/lib/stripe/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import { dollarsToCents } from "@/lib/charges/money";
import type { ChargeKind, ChargeLineItem } from "@/lib/charges/types";
import { mapPetRowToRecord } from "@/lib/pets/map";
import type { PetRow } from "@/lib/pets/types";
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import {
  vaccinationBookingNeedsAdminConfirmation,
  vaccinationReadyToBook,
} from "@/lib/vaccinations/booking";
import {
  allBookableServices,
  estimateServiceDurationMinutes,
  getServicePriceEstimate,
} from "@/lib/services";
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
  pets ( name, breed )
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
  petId?: string;
  serviceId?: string;
  removeAppointmentId?: string;
};

function visitKey(row: ChangeRow) {
  return [
    row.appointment_date,
    row.address_street.trim().toLowerCase(),
    row.address_zip,
  ].join("|");
}

function asChangeRow(row: ChangeRow): AppointmentRecord {
  return mapAppointmentRowToRecord(row);
}

async function loadOwnedAppointment(userId: string, appointmentId: string) {
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

async function loadVisitSiblings(userId: string, row: ChangeRow) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(CHANGE_SELECT)
    .eq("customer_id", userId)
    .eq("appointment_date", row.appointment_date)
    .neq("status", "cancelled");

  if (error) {
    console.error("loadVisitSiblings failed:", error.message);
    return { error: "server" as const };
  }

  const key = visitKey(row);
  return {
    rows: ((data ?? []) as unknown as ChangeRow[]).filter(
      (entry) => visitKey(entry) === key,
    ),
  };
}

function quoteForRows(action: AppointmentChangeAction, rows: ChangeRow[]) {
  const estimatedTotal = rows.reduce(
    (sum, row) => sum + Number(row.estimated_total ?? 0),
    0,
  );
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
) {
  const admin = createAdminClient();
  const query = admin
    .from("payment_methods")
    .select("id, stripe_payment_method_id")
    .eq("customer_id", customerId);

  const { data } = appointmentMethodId
    ? await query.eq("id", appointmentMethodId).maybeSingle()
    : await query.order("is_default", { ascending: false }).limit(1).maybeSingle();

  if (data?.id && data.stripe_payment_method_id) {
    return {
      id: data.id as string,
      stripePaymentMethodId: data.stripe_payment_method_id as string,
    };
  }

  if (appointmentMethodId) {
    const { data: fallback } = await admin
      .from("payment_methods")
      .select("id, stripe_payment_method_id")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback?.id && fallback.stripe_payment_method_id) {
      return {
        id: fallback.id as string,
        stripePaymentMethodId: fallback.stripe_payment_method_id as string,
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
}) {
  if (options.fee <= 0) return { ok: true as const };

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
    return { ok: true as const };
  } catch (error) {
    console.error("chargeChangeFee stripe failed:", error);
    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    return { error: "payment_failed" as const };
  }
}

async function cancelRows(rows: ChangeRow[]) {
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
    if (!input.date || !input.timePreference) return { error: "conflict" };
    const moved = await rescheduleRows(targetRows, input.date, input.timePreference);
    if ("error" in moved) return moved;
    return { ok: true, quote };
  }

  const cancelled = await cancelRows(targetRows);
  if ("error" in cancelled) return cancelled;
  return { ok: true, quote };
}

async function rescheduleRows(
  rows: ChangeRow[],
  date: string,
  preference: TimePreference,
) {
  const base = await getBaseGeoPoint();
  if (!base) return { error: "server" as const };
  const admin = createAdminClient();

  for (const row of rows) {
    if (row.address_lat == null || row.address_lon == null) {
      return { error: "server" as const };
    }
    const durationMinutes = estimateServiceDurationMinutes(
      row.service_id,
      20,
      row.add_on_ids ?? [],
    );
    const assignment = await assignArrivalWindow({
      date,
      point: { lat: row.address_lat, lon: row.address_lon },
      zip: row.address_zip,
      durationMinutes,
      preference,
      base,
    });
    if ("error" in assignment) {
      if (assignment.error === "slot_unavailable") {
        return { error: "slot_unavailable" as const };
      }
      return { error: "server" as const };
    }

    const { error } = await admin
      .from("appointments")
      .update({
        appointment_date: date,
        appointment_time: assignment.insertion.appointmentTime,
        scheduled_start: assignment.insertion.scheduledStart,
        time_preference: preference,
      })
      .eq("id", row.id);

    if (error) {
      console.error("rescheduleRows failed:", error.message);
      if (error.code === "23505") return { error: "slot_unavailable" as const };
      return { error: "server" as const };
    }
  }

  return { ok: true as const };
}

async function addDogToVisit(
  userId: string,
  visit: ChangeRow,
  input: ApplyAppointmentChangeInput,
) {
  if (!input.petId || !input.serviceId) return { error: "conflict" as const };
  if (visit.address_lat == null || visit.address_lon == null) {
    return { error: "server" as const };
  }

  const admin = createAdminClient();
  const { data: petRow, error: petError } = await admin
    .from("pets")
    .select(
      "id, customer_id, name, breed, weight_lbs, date_of_birth, approximate_age_years, sex, temperament_notes, health_comfort_notes, grooming_preferences, archived_at, created_at, updated_at",
    )
    .eq("id", input.petId)
    .eq("customer_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) {
    console.error("addDogToVisit pet failed:", petError.message);
    return { error: "server" as const };
  }
  if (!petRow) return { error: "not_found" as const };

  const [pet] = await attachVaccinationSummaries([
    mapPetRowToRecord(petRow as PetRow),
  ]);
  if (!vaccinationReadyToBook(pet.vaccinationBookingStatus)) {
    return { error: "conflict" as const };
  }

  const service = allBookableServices().find((entry) => entry.id === input.serviceId);
  if (!service) return { error: "conflict" as const };

  const estimate = getServicePriceEstimate(service, pet.weightLbs);
  const paymentMethod = await resolvePaymentMethod(
    userId,
    visit.payment_method_id,
  );
  if (!paymentMethod) return { error: "payment_required" as const };

  const base = await getBaseGeoPoint();
  if (!base) return { error: "server" as const };

  const preference =
    visit.time_preference === "afternoon" ? "afternoon" : "morning";
  const assignment = await assignArrivalWindow({
    date: visit.appointment_date,
    point: { lat: visit.address_lat, lon: visit.address_lon },
    zip: visit.address_zip,
    durationMinutes: estimateServiceDurationMinutes(service.id, pet.weightLbs, []),
    preference,
    base,
  });
  if ("error" in assignment) {
    if (assignment.error === "slot_unavailable") {
      return { error: "slot_unavailable" as const };
    }
    return { error: "server" as const };
  }

  const vaccinationStatus = pet.vaccinationBookingStatus ?? "missing";
  const status = vaccinationBookingNeedsAdminConfirmation(vaccinationStatus)
    ? "pending_confirmation"
    : "confirmed";

  const { data, error } = await admin
    .from("appointments")
    .insert({
      customer_id: userId,
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
      appointment_date: visit.appointment_date,
      appointment_time: assignment.insertion.appointmentTime,
      scheduled_start: assignment.insertion.scheduledStart,
      time_preference: preference,
      address_lat: visit.address_lat,
      address_lon: visit.address_lon,
      timezone: business.booking.timezone,
      estimated_total: estimate?.from ?? 0,
      new_client_deposit: 0,
      payment_method_id: paymentMethod.id,
      vaccination_status_at_booking: vaccinationStatus,
      status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
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
      await sendAppointmentCreatedEmails(appointment, contact);
    }
  } catch (emailError) {
    console.error("addDogToVisit email failed:", emailError);
  }

  return { appointment };
}
