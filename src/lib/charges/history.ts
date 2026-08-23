import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { mapAppointmentRowToAdminRecord } from "@/lib/appointments/map";
import type {
  AdminAppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import type {
  AppointmentChargeRecord,
  ChargeKind,
  ChargeLineItem,
  ChargeStatus,
  ReceiptChannel,
} from "@/lib/charges/types";

const CUSTOMER_HISTORY_APPOINTMENT_SELECT = `
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
  reminder_sms_sent_at,
  en_route_sms_sent_at,
  service_started_at,
  service_ended_at,
  pets ( name, breed ),
  profiles ( email, first_name, last_name, phone )
`;

export type StaffPaidOrder = AppointmentChargeRecord & {
  appointmentDate: string;
  petName: string;
  serviceName: string;
};

export type StaffCustomerHistory = {
  appointments: AdminAppointmentRecord[];
  orders: StaffPaidOrder[];
};

export async function listStaffCustomerHistory(
  customerId: string,
): Promise<
  | StaffCustomerHistory
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const admin = createAdminClient();
  const { data: appointmentRows, error: appointmentError } = await admin
    .from("appointments")
    .select(CUSTOMER_HISTORY_APPOINTMENT_SELECT)
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (appointmentError) {
    console.error("listStaffCustomerHistory appointments failed:", appointmentError.message);
    return { error: "server" };
  }

  const appointments = ((appointmentRows ?? []) as unknown as AppointmentRow[]).map(
    mapAppointmentRowToAdminRecord,
  );

  const appointmentIds = appointments.map((appointment) => appointment.id);
  if (appointmentIds.length === 0) {
    return { appointments, orders: [] };
  }

  const { data: chargeRows, error: chargeError } = await admin
    .from("appointment_charges")
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at",
    )
    .in("appointment_id", appointmentIds)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  if (chargeError) {
    console.error("listStaffCustomerHistory charges failed:", chargeError.message);
    return { appointments, orders: [] };
  }

  const appointmentById = new Map(
    appointments.map((appointment) => [appointment.id, appointment]),
  );

  const orders: StaffPaidOrder[] = (chargeRows ?? []).map((row) => {
    const appointment = appointmentById.get(row.appointment_id as string);
    return {
      id: row.id as string,
      appointmentId: row.appointment_id as string,
      kind: row.kind as ChargeKind,
      status: row.status as ChargeStatus,
      lineItems: (row.line_items ?? []) as ChargeLineItem[],
      subtotal: Number(row.subtotal),
      tipAmount: Number(row.tip_amount),
      total: Number(row.total),
      receiptChannel: (row.receipt_channel as ReceiptChannel | null) ?? null,
      paidAt: (row.paid_at as string | null) ?? null,
      refundedAmount: Number((row as { refunded_amount?: number }).refunded_amount ?? 0),
      appointmentDate: appointment?.appointmentDate ?? "",
      petName: appointment?.petName ?? "",
      serviceName: appointment?.serviceName ?? "",
    };
  });

  return { appointments, orders };
}
