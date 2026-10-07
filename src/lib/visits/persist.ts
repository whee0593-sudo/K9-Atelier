import { createAdminClient } from "@/lib/supabase/admin";

export type StaffVisitInsert = {
  customer_id: string;
  service_date: string;
  scheduled_start: number;
  time_preference: "morning" | "afternoon" | null;
  timezone: string;
  status: "pending_confirmation" | "confirmed" | "completed" | "cancelled";
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_lat: number | null;
  address_lon: number | null;
  travel_distance_miles: number;
  travel_fee: number;
};

export type StaffVisitAppointmentInsert = {
  customer_id: string;
  pet_id: string;
  service_id: string;
  service_name: string;
  add_on_ids: string[];
  add_on_options: Record<string, string>;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  travel_distance_miles: number;
  travel_fee: number;
  service_price: number;
  estimated_duration_minutes: number;
  appointment_date: string;
  appointment_time: string | null;
  scheduled_start: number;
  time_preference: "morning" | "afternoon" | null;
  address_lat: number | null;
  address_lon: number | null;
  timezone: string;
  estimated_total: number;
  new_client_deposit: number;
  payment_method_id: string | null;
  vaccination_status_at_booking: string;
  status: "pending_confirmation" | "confirmed" | "completed" | "cancelled";
  confirmed_at: string | null;
  staff_created: boolean;
  customer_confirm_token_hash: string;
  customer_confirm_expires_at: string;
};

export type VisitScheduleChild = {
  id: string;
  scheduledStart: number;
  durationMinutes: number;
  appointmentTime: string | null;
  timePreference: "morning" | "afternoon" | null;
};

type MutationError = { code?: string; message?: string };

function mutationResult(error: MutationError) {
  if (error.code === "23505" || /duplicate key/i.test(error.message ?? "")) {
    return { error: "slot_unavailable" as const };
  }
  return { error: "server" as const };
}

/**
 * Insert the visit and every pet appointment in one database function.
 * PostgreSQL rolls the whole function back when any insert fails.
 */
export async function createStaffVisit(input: {
  visit: StaffVisitInsert;
  appointments: StaffVisitAppointmentInsert[];
}): Promise<{ visitId: string } | { error: "server" | "slot_unavailable" }> {
  if (input.appointments.length === 0) return { error: "server" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_staff_visit", {
    p_visit: input.visit,
    p_appointments: input.appointments,
  });
  if (error || !data) {
    console.error(
      "createStaffVisit failed:",
      error?.code,
      error?.message,
    );
    if (!error) return { error: "server" };
    return mutationResult(error);
  }
  return { visitId: data as string };
}

/**
 * Replace a visit's date and every child start in one database function.
 * Clearing the old starts is inside that transaction, so a failed write
 * restores the previous schedule.
 */
export async function replaceVisitSchedule(input: {
  visitId: string;
  serviceDate: string | null;
  visitStartMinutes: number;
  timePreference: "morning" | "afternoon" | null;
  children: VisitScheduleChild[];
}): Promise<{ ok: true } | { error: "server" | "slot_unavailable" }> {
  if (!input.visitId || input.children.length === 0) return { error: "server" };
  const starts = input.children.map((child) => child.scheduledStart);
  if (Math.min(...starts) !== input.visitStartMinutes) {
    console.error("replaceVisitSchedule arrival does not match the first pet");
    return { error: "server" };
  }
  const admin = createAdminClient();
  const { error } = await admin.rpc("replace_visit_schedule", {
    p_visit_id: input.visitId,
    p_service_date: input.serviceDate,
    p_visit_start: input.visitStartMinutes,
    p_time_preference: input.timePreference,
    p_children: input.children.map((child) => ({
      id: child.id,
      scheduled_start: child.scheduledStart,
      estimated_duration_minutes: child.durationMinutes,
      appointment_time: child.appointmentTime,
      time_preference: child.timePreference,
    })),
  });
  if (error) {
    console.error(
      "replaceVisitSchedule failed:",
      error.code,
      error.message,
    );
    return mutationResult(error);
  }
  return { ok: true };
}
