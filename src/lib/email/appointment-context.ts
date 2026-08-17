import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type { AdminAppointmentRecord, AppointmentRow } from "@/lib/appointments/types";
import { createAuthenticatedSupabaseClient } from "@/lib/pets/auth";

const ADMIN_APPOINTMENT_SELECT = `
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
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

export async function fetchAppointmentAdminRecord(
  appointmentId: string,
): Promise<AdminAppointmentRecord | null> {
  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(ADMIN_APPOINTMENT_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("fetchAppointmentAdminRecord failed:", error.message);
    return null;
  }

  if (!data) return null;
  return mapAppointmentRowToAdminRecord(data as AppointmentRow);
}

export type CustomerContact = {
  email: string;
  name: string | null;
  firstName?: string | null;
  phone?: string | null;
};

export function contactFromAdminAppointment(
  appointment: AdminAppointmentRecord,
): CustomerContact | null {
  if (!appointment.customerEmail) return null;
  return {
    email: appointment.customerEmail,
    name: appointment.customerName,
    firstName: appointment.customerFirstName,
    phone: appointment.customerPhone,
  };
}

export async function fetchCustomerContact(
  customerId: string,
): Promise<CustomerContact | null> {
  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("email, first_name, last_name, phone")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    console.error("fetchCustomerContact failed:", error.message);
    return null;
  }

  if (!data?.email) return null;
  const nameParts = [data.first_name, data.last_name].filter(Boolean);
  return {
    email: data.email,
    name: nameParts.length > 0 ? nameParts.join(" ") : null,
    firstName: data.first_name,
    phone: data.phone,
  };
}
