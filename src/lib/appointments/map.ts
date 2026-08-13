import type {
  AdminAppointmentRecord,
  AppointmentRecord,
  AppointmentRow,
} from "@/lib/appointments/types";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapVaccinationStatus(
  value: string | null | undefined,
): VaccinationBookingStatus | null {
  if (
    value === "current" ||
    value === "expiring_soon" ||
    value === "needs_review" ||
    value === "needs_attention" ||
    value === "expired" ||
    value === "missing"
  ) {
    return value;
  }
  return null;
}

export function mapAppointmentRowToRecord(row: AppointmentRow): AppointmentRecord {
  const pet = firstRelation(row.pets);

  return {
    id: row.id,
    customerId: row.customer_id,
    petId: row.pet_id,
    petName: pet?.name ?? "Unknown pet",
    petBreed: pet?.breed ?? "",
    serviceId: row.service_id,
    serviceName: row.service_name,
    addOnIds: row.add_on_ids ?? [],
    addOnOptions: row.add_on_options ?? {},
    addressStreet: row.address_street,
    addressCity: row.address_city,
    addressState: row.address_state,
    addressZip: row.address_zip,
    travelDistanceMiles: Number(row.travel_distance_miles),
    travelFee: Number(row.travel_fee),
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    timezone: row.timezone,
    estimatedTotal:
      row.estimated_total == null ? null : Number(row.estimated_total),
    newClientDeposit:
      row.new_client_deposit == null ? null : Number(row.new_client_deposit),
    vaccinationStatusAtBooking: mapVaccinationStatus(
      row.vaccination_status_at_booking,
    ),
    status: row.status,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}

export function mapAppointmentRowToAdminRecord(
  row: AppointmentRow,
): AdminAppointmentRecord {
  const profile = firstRelation(row.profiles);
  const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean);

  return {
    ...mapAppointmentRowToRecord(row),
    customerEmail: profile?.email ?? "",
    customerName: nameParts.length > 0 ? nameParts.join(" ") : null,
  };
}

export function appointmentStatusLabel(status: AppointmentRecord["status"]) {
  switch (status) {
    case "pending_confirmation":
      return "Pending confirmation";
    case "confirmed":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
  }
}

export function appointmentIsUpcoming(record: AppointmentRecord) {
  if (record.status === "cancelled") return false;
  const date = new Date(`${record.appointmentDate}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date >= startOfToday();
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
