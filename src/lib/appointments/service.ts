import { business } from "@/lib/business";
import {
  mapAppointmentRowToAdminRecord,
  mapAppointmentRowToRecord,
} from "@/lib/appointments/map";
import { isOperationalAdminAppointment } from "@/lib/appointments/operational-visibility";
import type {
  AdminAppointmentRecord,
  AppointmentRecord,
  AppointmentRow,
  AppointmentWriteInput,
} from "@/lib/appointments/types";
import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import { mapPetRowToRecord } from "@/lib/pets/map";
import { PET_SELECT, type PetRow } from "@/lib/pets/types";
import { bookingWeightLbs } from "@/lib/pets/weight";
import { resolveArrivalForBooking } from "@/lib/appointments/arrival-window";
import { vaccinationStatusSnapshotForBooking } from "@/lib/vaccinations/booking";
import {
  contactFromAdminAppointment,
  fetchAppointmentAdminRecord,
  fetchCustomerContact,
} from "@/lib/email/appointment-context";
import {
  sendAppointmentCreatedEmails,
  sendAppointmentStatusEmails,
} from "@/lib/email/appointment-mails";
import { getCustomerPaymentMethod } from "@/lib/payments/service";
import { resolveGuestDrivingQuote } from "@/lib/booking-distance";
import {
  evaluateSubmittedBookingPrice,
  type BookingPriceQuote,
} from "@/lib/booking-price";
import {
  guestBookingIntentHash,
  insertGuestBooking,
} from "@/lib/appointments/guest-booking";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { snapshotServicePrice, visitArrivalFields } from "@/lib/visits/visit";
import { syncVisitTravelFeeMirror } from "@/lib/visits/travel-mirror";
import {
  assignArrivalWindow,
  claimDayPlan,
  getBaseGeoPoint,
} from "@/lib/appointments/schedule";

const APPOINTMENT_SELECT = `
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
  visit_id,
  estimated_duration_minutes,
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
  created_at,
  pets ( name, breed )
`;

const ADMIN_APPOINTMENT_SELECT = `
  ${APPOINTMENT_SELECT.trim().replace(
    "pets ( name, breed )",
    "pets ( name, breed, weight_lbs )",
  )},
  profiles ( email, first_name, last_name, phone )
`;

const ADMIN_TODAY_APPOINTMENT_SELECT = `
  ${ADMIN_APPOINTMENT_SELECT.trim()},
  reminder_sms_sent_at,
  en_route_sms_sent_at,
  service_started_at,
  service_ended_at
`;

export async function createAppointment(
  input: AppointmentWriteInput,
): Promise<
  | { appointment: AppointmentRecord }
  | {
      error:
        | "unauthenticated"
        | "not_found"
        | "conflict"
        | "slot_unavailable"
        | "payment_required"
        | "weight_required"
        | "invalid_selection"
        | "price_changed"
        | "address_unverified"
        | "idempotency_mismatch"
        | "server";
      message?: string;
      quote?: BookingPriceQuote;
    }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data: petRow, error: petError } = await supabase
    .from("pets")
    .select(PET_SELECT)
    .eq("id", input.petId)
    .eq("customer_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) {
    console.error("createAppointment pet lookup failed:", petError.message);
    return { error: "server" };
  }
  if (!petRow) return { error: "not_found" };

  const mappedPet = mapPetRowToRecord(petRow as PetRow);
  const bookedWeight = bookingWeightLbs(mappedPet.weightLbs);
  if (bookedWeight == null) return { error: "weight_required" };
  let pet = mappedPet;
  try {
    const [enriched] = await attachVaccinationSummaries([mappedPet]);
    if (enriched) pet = enriched;
  } catch (vaccinationError) {
    console.error(
      "createAppointment vaccination summary failed:",
      vaccinationError,
    );
  }
  const vaccinationStatus = vaccinationStatusSnapshotForBooking(pet);

  const paymentMethod = await getCustomerPaymentMethod(
    user.id,
    input.paymentMethodId,
  );
  if (!paymentMethod) return { error: "payment_required" };

  const measured = await resolveGuestDrivingQuote(input.address);
  if (!measured.ok) {
    if (measured.code === "outside_area") {
      return { error: "invalid_selection", message: measured.message };
    }
    return { error: "address_unverified", message: measured.message };
  }

  const priced = evaluateSubmittedBookingPrice(
    {
      serviceId: input.serviceId,
      addOnIds: input.addOnIds,
      addOnOptions: input.addOnOptions,
      distanceMiles: measured.distanceMiles,
      estimatedTotal: input.estimatedTotal,
    },
    bookedWeight,
  );
  if (!priced.ok) {
    if (priced.code === "price_changed" && priced.quote) {
      return {
        error: "price_changed",
        message: priced.message,
        quote: priced.quote,
      };
    }
    return { error: "invalid_selection", message: priced.message };
  }
  const quote = priced.quote;

  const durationMinutes = estimateServiceDurationMinutes(
    input.serviceId,
    bookedWeight,
    input.addOnIds,
  );
  const point = measured.point;
  const base = await getBaseGeoPoint();
  const assignment = base
    ? await assignArrivalWindow({
        date: input.appointmentDate,
        point,
        zip: input.address.zip,
        durationMinutes,
        slotStartMinutes: input.slotStartMinutes,
        base,
      })
    : { error: "misconfigured" as const };
  const schedule = resolveArrivalForBooking(
    assignment,
    input.slotStartMinutes,
  );
  if ("error" in schedule) return { error: "slot_unavailable" };

  if (base) {
    const claimed = await claimDayPlan(
      input.appointmentDate,
      input.address.zip,
      point,
    );
    if ("error" in claimed) {
      if (claimed.error === "slot_unavailable") return { error: "slot_unavailable" };
      console.error(
        "createAppointment day plan was not claimed; booking continues:",
        claimed.error,
      );
    }
  }

  const { error: phoneError } = await supabase
    .from("profiles")
    .update({
      phone: input.customerPhone,
      first_name: input.customerFirstName,
      last_name: input.customerLastName,
    })
    .eq("id", user.id);

  if (phoneError) {
    console.error("createAppointment phone save failed:", phoneError.message);
  }

  let referralCodeToAttach: string | null = null;
  if (input.referralCode?.trim()) {
    try {
      const { validateReferralCodeForCustomer } = await import(
        "@/lib/referrals/service"
      );
      const referral = await validateReferralCodeForCustomer(
        user.id,
        input.referralCode,
      );
      if (referral.valid) {
        referralCodeToAttach = input.referralCode;
      } else {
        console.error(
          "createAppointment referral skipped:",
          referral.message,
        );
      }
    } catch (referralError) {
      console.error("createAppointment referral check failed:", referralError);
    }
  }

  const status = "confirmed";
  const servicePrice = snapshotServicePrice(quote.estimatedServicePrice);
  const arrival = visitArrivalFields(schedule.scheduledStart);
  const payloadHash = guestBookingIntentHash({
    petId: input.petId,
    serviceId: input.serviceId,
    addOnIds: input.addOnIds,
    addOnOptions: input.addOnOptions,
    address: input.address,
    appointmentDate: input.appointmentDate,
    slotStartMinutes: input.slotStartMinutes,
    paymentMethodId: input.paymentMethodId,
  });
  const admin = createAdminClient();
  const saved = await insertGuestBooking(
    {
      rpc: (fn, args) =>
        admin.rpc(fn, args) as PromiseLike<{
          data: unknown;
          error: { code?: string; message?: string } | null;
        }>,
    },
    {
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      visit: {
        customer_id: user.id,
        service_date: input.appointmentDate,
        scheduled_start: arrival.scheduledStart,
        appointment_time: arrival.appointmentTime,
        time_preference: schedule.timePreference,
        timezone: business.booking.timezone,
        status,
        address_street: input.address.street,
        address_city: input.address.city,
        address_state: input.address.state,
        address_zip: input.address.zip,
        address_lat: point.lat,
        address_lon: point.lon,
        travel_distance_miles: quote.travelDistanceMiles,
        travel_fee: quote.travelFee,
      },
      appointment: {
        customer_id: user.id,
        pet_id: input.petId,
        service_id: input.serviceId,
        service_name: quote.serviceName,
        add_on_ids: input.addOnIds,
        add_on_options: input.addOnOptions,
        address_street: input.address.street,
        address_city: input.address.city,
        address_state: input.address.state,
        address_zip: input.address.zip,
        travel_distance_miles: quote.travelDistanceMiles,
        travel_fee: quote.travelFee,
        service_price: servicePrice,
        estimated_duration_minutes: durationMinutes,
        visit_sequence: 1,
        appointment_date: input.appointmentDate,
        appointment_time: schedule.appointmentTime,
        scheduled_start: schedule.scheduledStart,
        time_preference: schedule.timePreference,
        address_lat: point.lat,
        address_lon: point.lon,
        timezone: business.booking.timezone,
        estimated_total: quote.estimatedTotal,
        new_client_deposit: 0,
        payment_method_id: input.paymentMethodId,
        vaccination_status_at_booking: vaccinationStatus,
        status,
        confirmed_at: new Date().toISOString(),
      },
    },
  );
  if ("error" in saved) return saved;

  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("id", saved.appointmentId)
    .single();
  if (error || !data) {
    console.error("createAppointment reload failed:", error?.message);
    return { error: "server" };
  }

  const appointment = mapAppointmentRowToRecord(data as AppointmentRow);

  // The visit and appointment are already committed. Mail and SMS run only
  // when this request created them. A retry returns the original appointment
  // and skips this block, so it does not send a second notice. A crash after
  // commit and before this block does not send on the retry either.
  if (saved.created && referralCodeToAttach) {
    try {
      const { attachReferralOnBooking } = await import("@/lib/referrals/service");
      await attachReferralOnBooking({
        referredCustomerId: user.id,
        appointmentId: appointment.id,
        code: referralCodeToAttach,
      });
    } catch (referralError) {
      console.error("createAppointment referral attach failed:", referralError);
    }
  }

  if (saved.created) {
    try {
      const contact =
        (await fetchCustomerContact(user.id)) ??
        (user.email ? { email: user.email, name: null } : null);
      if (contact) {
        await sendAppointmentCreatedEmails(appointment, {
          ...contact,
          phone: contact.phone ?? input.customerPhone,
        });
      }
    } catch (emailError) {
      console.error("createAppointment email failed:", emailError);
    }
    try {
      const { notifyMerchantSelfBooking } = await import(
        "@/lib/communications/merchant-visit"
      );
      await notifyMerchantSelfBooking(appointment.id);
    } catch (merchantError) {
      console.error("createAppointment merchant notice failed:", merchantError);
    }
  }

  return { appointment };
}

export async function listCustomerAppointments(): Promise<
  | { appointments: AppointmentRecord[] }
  | { error: "unauthenticated" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("customer_id", user.id)
    .order("appointment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCustomerAppointments failed:", error.code, error.message);
    return { error: "server" };
  }

  return {
    appointments: ((data ?? []) as unknown as AppointmentRow[]).map(
      mapAppointmentRowToRecord,
    ),
  };
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: "confirmed" | "cancelled",
): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  let session: Awaited<
    ReturnType<typeof import("@/lib/staff/auth").getStaffSession>
  >;
  try {
    const { getStaffSession } = await import("@/lib/staff/auth");
    session = await getStaffSession();
  } catch (error) {
    console.error("setAppointmentStatus auth failed:", error);
    return { error: "unauthenticated" };
  }
  if ("error" in session) return { error: session.error };

  const appointmentBeforeUpdate = await fetchAppointmentAdminRecord(appointmentId);

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase.rpc("staff_set_appointment_status", {
    p_appointment_id: appointmentId,
    p_status: status,
  });

  if (error) {
    console.error("setAppointmentStatus failed:", error.code, error.message);
    if (error.message.includes("not found")) return { error: "not_found" };
    if (error.message.includes("not authorized")) return { error: "forbidden" };
    return { error: "server" };
  }

  if (!data) return { error: "not_found" };

  if (status === "cancelled" && appointmentBeforeUpdate?.visitId) {
    try {
      await syncVisitTravelFeeMirror(appointmentBeforeUpdate.visitId);
      const { compactVisitChildStarts } = await import("@/lib/visits/compact");
      await compactVisitChildStarts(appointmentBeforeUpdate.visitId);
    } catch (compactError) {
      console.error("setAppointmentStatus compact failed:", compactError);
    }
  }

  if (appointmentBeforeUpdate) {
    const contact = contactFromAdminAppointment(appointmentBeforeUpdate);
    if (contact) {
      try {
        await sendAppointmentStatusEmails(
          { ...appointmentBeforeUpdate, status },
          contact,
          status,
          appointmentBeforeUpdate.status,
        );
      } catch (emailError) {
        console.error("setAppointmentStatus email failed:", emailError);
      }
    }
  }

  return { ok: true };
}

export async function listTodayAdminAppointments(): Promise<
  | { appointments: AdminAppointmentRecord[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const { todayInBusinessTimezone } = await import("@/lib/sms/schedule");
  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(ADMIN_TODAY_APPOINTMENT_SELECT)
    .neq("status", "cancelled")
    .eq("appointment_date", todayInBusinessTimezone())
    .order("scheduled_start", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error(
      "listTodayAdminAppointments failed:",
      error.code,
      error.message,
    );
    return { error: "server" };
  }

  return {
    appointments: ((data ?? []) as unknown as AppointmentRow[])
      .map(mapAppointmentRowToAdminRecord)
      .filter((appointment) =>
        isOperationalAdminAppointment(appointment.status),
      ),
  };
}

export async function listAdminAppointmentsOnDate(
  date: string,
): Promise<
  | { appointments: AdminAppointmentRecord[] }
  | { error: "unauthenticated" | "forbidden" | "conflict" | "server" }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "conflict" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(ADMIN_TODAY_APPOINTMENT_SELECT)
    .eq("appointment_date", date)
    .neq("status", "cancelled")
    .order("scheduled_start", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("listAdminAppointmentsOnDate failed:", error.message);
    return { error: "server" };
  }

  return {
    appointments: ((data ?? []) as unknown as AppointmentRow[]).map(
      mapAppointmentRowToAdminRecord,
    ),
  };
}

export async function sendAppointmentEnRouteNotification(
  appointmentId: string,
): Promise<
  | { ok: true }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "misconfigured"
        | "server";
    }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const { isSmsConfigured } = await import("@/lib/sms/twilio");
  if (!isSmsConfigured()) return { error: "misconfigured" };

  const appointment = await fetchAppointmentAdminRecord(appointmentId);
  if (!appointment || !isOperationalAdminAppointment(appointment.status)) {
    return { error: "not_found" };
  }

  const contact = contactFromAdminAppointment(appointment);
  if (!contact?.phone) return { error: "conflict" };

  const { hasSupabaseAdminConfig } = await import("@/lib/supabase/env");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };

  const admin = createAdminClient();
  type EnRouteDog = {
    appointmentId: string;
    status: string;
    serviceEndedAt: null;
    logisticsSentAt: string | null;
    petName: string | null;
    petId: string | null;
  };
  let dogs: EnRouteDog[];
  if (!appointment.visitId) {
    dogs = [
      {
        appointmentId: appointment.id,
        status: appointment.status,
        serviceEndedAt: null,
        logisticsSentAt: appointment.enRouteSmsSentAt,
        petName: appointment.petName,
        petId: appointment.petId,
      },
    ];
  } else {
    const visit = await admin
      .from("appointments")
      .select("id, status, pet_id, en_route_sms_sent_at, pets ( name )")
      .eq("visit_id", appointment.visitId)
      .neq("status", "cancelled");
    if (visit.error) {
      console.error(
        "sendAppointmentEnRouteNotification lookup failed:",
        visit.error.message,
      );
      return { error: "server" };
    }

    const rows = (visit.data ?? []) as Array<{
      id: string;
      status: string;
      pet_id: string | null;
      en_route_sms_sent_at: string | null;
      pets?: { name: string | null } | { name: string | null }[] | null;
    }>;
    dogs = rows.map((row) => {
      const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
      return {
        appointmentId: row.id,
        status: row.status,
        serviceEndedAt: null,
        logisticsSentAt: row.en_route_sms_sent_at,
        petName: pet?.name ?? appointment.petName,
        petId: row.pet_id,
      };
    });
  }
  const { planVisitLogisticsSms, joinPetNames } = await import(
    "@/lib/communications/visit-readiness"
  );
  const plan = planVisitLogisticsSms({ event: "en_route", dogs });
  const markSent = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error: markError } = await admin
      .from("appointments")
      .update({ en_route_sms_sent_at: new Date().toISOString() })
      .in("id", ids)
      .is("en_route_sms_sent_at", null);
    if (markError) {
      console.error(
        "sendAppointmentEnRouteNotification mark failed:",
        markError.message,
      );
    }
  };
  if (plan.action === "already_sent") {
    await markSent(plan.appointmentIds);
    return { error: "conflict" };
  }
  if (plan.action !== "send") return { error: "conflict" };

  const { bookingDetailsFromAppointment } = await import(
    "@/lib/email/appointment-mails"
  );
  const { buildAppointmentEnRouteSms } = await import("@/lib/notifications");
  const { normalizePhoneToE164 } = await import("@/lib/sms/phone");
  const to = normalizePhoneToE164(contact.phone);
  if (!to) return { error: "conflict" };
  const details = {
    ...bookingDetailsFromAppointment(appointment, contact),
    petName: joinPetNames(dogs.map((dog) => dog.petName)),
  };
  const body = buildAppointmentEnRouteSms(details);
  const { deliverVisitLogisticsSms } = await import(
    "@/lib/communications/visit-sms"
  );
  const { communicationAppointmentScope, communicationVisitScope } = await import(
    "@/lib/communications/keys"
  );
  const { createSupabaseClaimStore } = await import(
    "@/lib/communications/supabase-store"
  );
  const { sendTrackedSms } = await import("@/lib/communications/provider");
  const outcome = await deliverVisitLogisticsSms({
    event: "en_route",
    visitId: appointment.visitId ?? null,
    scope: appointment.visitId
      ? communicationVisitScope(appointment.visitId)
      : communicationAppointmentScope(appointment.id),
    dogs,
    customerId: appointment.customerId,
    petIds: dogs.map((dog) => dog.petId).filter((id): id is string => Boolean(id)),
    recipient: to,
    body,
    store: createSupabaseClaimStore(admin),
    send: async () => {
      const result = await sendTrackedSms({ to, body });
      if (result.outcome === "skipped") {
        return { outcome: "failed" as const, error: "missing_config" };
      }
      return result;
    },
  });
  if (outcome === "accepted" || outcome === "duplicate") {
    await markSent(plan.appointmentIds);
    return { ok: true };
  }
  if (outcome === "failed" || outcome === "unrecorded") return { error: "server" };
  return { error: "conflict" };
}

export async function setAppointmentVisitTiming(
  appointmentId: string,
  action: "check_in" | "check_out",
  options?: { sendCheckoutText?: boolean },
): Promise<
  | { startedAt: string | null; endedAt: string | null }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "server";
    }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointments")
    .select("id, service_started_at, service_ended_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("setAppointmentVisitTiming load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };

  const now = new Date().toISOString();
  if (action === "check_out" && !row.service_started_at) {
    return { error: "conflict" };
  }

  const next =
    action === "check_in"
      ? { service_started_at: now, service_ended_at: null }
      : {
          service_started_at: (row.service_started_at as string | null) ?? now,
          service_ended_at: now,
        };

  const { data: updated, error: updateError } = await admin
    .from("appointments")
    .update(next)
    .eq("id", appointmentId)
    .select("service_started_at, service_ended_at")
    .single();

  if (updateError || !updated) {
    console.error("setAppointmentVisitTiming save failed:", updateError?.message);
    return { error: "server" };
  }

  if (
    action === "check_out" &&
    !row.service_ended_at &&
    options?.sendCheckoutText !== false
  ) {
    try {
      const { sendCheckoutReadySms } = await import("@/lib/sms/checkout");
      await sendCheckoutReadySms(appointmentId);
    } catch (smsError) {
      console.error("checkout ready SMS failed:", smsError);
    }
  }

  return {
    startedAt: (updated.service_started_at as string | null) ?? null,
    endedAt: (updated.service_ended_at as string | null) ?? null,
  };
}
