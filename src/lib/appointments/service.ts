import { business } from "@/lib/business";
import {
  mapAppointmentRowToAdminRecord,
  mapAppointmentRowToRecord,
} from "@/lib/appointments/map";
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
import { attachVaccinationSummaries } from "@/lib/vaccinations/service";
import { mapPetRowToRecord } from "@/lib/pets/map";
import type { PetRow } from "@/lib/pets/types";
import {
  vaccinationBookingNeedsAdminConfirmation,
  vaccinationReadyToBook,
} from "@/lib/vaccinations/booking";
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
import { estimateServiceDurationMinutes } from "@/lib/services";
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
  pets ( name, breed )
`;

const ADMIN_APPOINTMENT_SELECT = `
  ${APPOINTMENT_SELECT.trim()},
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
        | "server";
    }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data: petRow, error: petError } = await supabase
    .from("pets")
    .select(
      "id, customer_id, name, breed, weight_lbs, date_of_birth, approximate_age_years, sex, temperament_notes, health_comfort_notes, grooming_preferences, archived_at, created_at, updated_at",
    )
    .eq("id", input.petId)
    .eq("customer_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) {
    console.error("createAppointment pet lookup failed:", petError.message);
    return { error: "server" };
  }
  if (!petRow) return { error: "not_found" };

  const [pet] = await attachVaccinationSummaries([
    mapPetRowToRecord(petRow as PetRow),
  ]);
  const vaccinationStatus = pet.vaccinationBookingStatus ?? "missing";

  if (!vaccinationReadyToBook(vaccinationStatus)) {
    return { error: "conflict" };
  }

  const paymentMethod = await getCustomerPaymentMethod(
    user.id,
    input.paymentMethodId,
  );
  if (!paymentMethod) return { error: "payment_required" };

  const base = await getBaseGeoPoint();
  if (!base) return { error: "server" };

  const durationMinutes = estimateServiceDurationMinutes(
    input.serviceId,
    pet.weightLbs,
    input.addOnIds,
  );
  const point = { lat: input.addressLat, lon: input.addressLon };
  const assignment = await assignArrivalWindow({
    date: input.appointmentDate,
    point,
    zip: input.address.zip,
    durationMinutes,
    preference: input.timePreference,
    base,
  });
  if ("error" in assignment) {
    if (assignment.error === "slot_unavailable") return { error: "slot_unavailable" };
    if (assignment.error === "misconfigured") return { error: "server" };
    return { error: "server" };
  }

  const claimed = await claimDayPlan(
    input.appointmentDate,
    input.address.zip,
    point,
  );
  if ("error" in claimed) {
    if (claimed.error === "slot_unavailable") return { error: "slot_unavailable" };
    if (claimed.error === "misconfigured") return { error: "server" };
    return { error: "server" };
  }

  const { error: phoneError } = await supabase
    .from("profiles")
    .update({ phone: input.customerPhone })
    .eq("id", user.id);

  if (phoneError) {
    console.error("createAppointment phone save failed:", phoneError.message);
    return { error: "server" };
  }

  const status = vaccinationBookingNeedsAdminConfirmation(vaccinationStatus)
    ? "pending_confirmation"
    : "confirmed";

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      customer_id: user.id,
      pet_id: input.petId,
      service_id: input.serviceId,
      service_name: input.serviceName,
      add_on_ids: input.addOnIds,
      add_on_options: input.addOnOptions,
      address_street: input.address.street,
      address_city: input.address.city,
      address_state: input.address.state,
      address_zip: input.address.zip,
      travel_distance_miles: input.travelDistanceMiles,
      travel_fee: input.travelFee,
      appointment_date: input.appointmentDate,
      appointment_time: assignment.insertion.appointmentTime,
      scheduled_start: assignment.insertion.scheduledStart,
      time_preference: input.timePreference,
      address_lat: input.addressLat,
      address_lon: input.addressLon,
      timezone: business.booking.timezone,
      estimated_total: input.estimatedTotal,
      new_client_deposit: 0,
      payment_method_id: input.paymentMethodId,
      vaccination_status_at_booking: vaccinationStatus,
      status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    console.error("createAppointment insert failed:", error.code, error.message);
    if (error.code === "23505") return { error: "slot_unavailable" };
    return { error: "server" };
  }

  const appointment = mapAppointmentRowToRecord(data as AppointmentRow);

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

export async function listPendingAdminAppointments(): Promise<
  | { appointments: AdminAppointmentRecord[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(ADMIN_APPOINTMENT_SELECT)
    .eq("status", "pending_confirmation")
    .order("appointment_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "listPendingAdminAppointments failed:",
      error.code,
      error.message,
    );
    return { error: "server" };
  }

  return {
    appointments: ((data ?? []) as unknown as AppointmentRow[]).map(
      mapAppointmentRowToAdminRecord,
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
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
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

  if (appointmentBeforeUpdate) {
    const contact = contactFromAdminAppointment(appointmentBeforeUpdate);
    if (contact) {
      try {
        await sendAppointmentStatusEmails(
          { ...appointmentBeforeUpdate, status },
          contact,
          status,
        );
      } catch (emailError) {
        console.error("setAppointmentStatus email failed:", emailError);
      }
    }
  }

  return { ok: true };
}

export async function listTodayConfirmedAdminAppointments(): Promise<
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
    .eq("status", "confirmed")
    .eq("appointment_date", todayInBusinessTimezone())
    .order("scheduled_start", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error(
      "listTodayConfirmedAdminAppointments failed:",
      error.code,
      error.message,
    );
    return { error: "server" };
  }

  return {
    appointments: ((data ?? []) as unknown as AppointmentRow[]).map(
      mapAppointmentRowToAdminRecord,
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
  if (!appointment || appointment.status !== "confirmed") {
    return { error: "not_found" };
  }

  const contact = contactFromAdminAppointment(appointment);
  if (!contact?.phone) return { error: "conflict" };

  const { hasSupabaseAdminConfig } = await import("@/lib/supabase/env");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };

  const admin = createAdminClient();
  const { data: smsRow, error: smsLookupError } = await admin
    .from("appointments")
    .select("en_route_sms_sent_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (smsLookupError) {
    console.error(
      "sendAppointmentEnRouteNotification lookup failed:",
      smsLookupError.message,
    );
    return { error: "server" };
  }
  if (smsRow?.en_route_sms_sent_at) return { error: "conflict" };

  const { sendAppointmentEnRouteSms } = await import(
    "@/lib/sms/appointment-sms"
  );
  const sent = await sendAppointmentEnRouteSms(appointment, contact);
  if (!sent) return { error: "server" };

  const { error: markError } = await admin
    .from("appointments")
    .update({ en_route_sms_sent_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (markError) {
    console.error(
      "sendAppointmentEnRouteNotification mark failed:",
      markError.message,
    );
  }

  return { ok: true };
}

export async function setAppointmentVisitTiming(
  appointmentId: string,
  action: "check_in" | "check_out",
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

  return {
    startedAt: (updated.service_started_at as string | null) ?? null,
    endedAt: (updated.service_ended_at as string | null) ?? null,
  };
}
