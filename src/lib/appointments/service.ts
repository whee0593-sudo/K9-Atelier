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
  timezone,
  estimated_total,
  new_client_deposit,
  vaccination_status_at_booking,
  status,
  confirmed_at,
  created_at,
  pets ( name, breed )
`;

const ADMIN_APPOINTMENT_SELECT = `
  ${APPOINTMENT_SELECT.trim()},
  profiles ( email, first_name, last_name )
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
      appointment_time: input.appointmentTime,
      timezone: business.booking.timezone,
      estimated_total: input.estimatedTotal,
      new_client_deposit: input.newClientDeposit,
      vaccination_status_at_booking: vaccinationStatus,
      status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    console.error("createAppointment insert failed:", error.code, error.message);
    return { error: "server" };
  }

  return {
    appointment: mapAppointmentRowToRecord(data as AppointmentRow),
  };
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
  return { ok: true };
}
