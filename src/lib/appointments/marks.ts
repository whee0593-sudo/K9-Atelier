import type { AppointmentStatus } from "@/lib/appointments/types";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

export type AppointmentCornerKind = "customer_yes" | "vaccination_alert" | null;

type MarkInput = {
  status: AppointmentStatus;
  vaccinationStatusAtBooking?: VaccinationBookingStatus | null;
  customerConfirmedAt?: string | null;
};

const FAILED_VACCINE_STATUSES = new Set<VaccinationBookingStatus>([
  "needs_review",
  "needs_attention",
  "expired",
  "missing",
]);

/**
 * Vaccine-blocked bookings show ! until staff books them.
 * Customer YES is a separate confirm mark, only after the booking succeeded.
 */
export function appointmentCornerMark(appointment: MarkInput): AppointmentCornerKind {
  if (appointment.status === "pending_confirmation") {
    return "vaccination_alert";
  }

  if (
    appointment.status === "cancelled" &&
    appointment.vaccinationStatusAtBooking &&
    FAILED_VACCINE_STATUSES.has(appointment.vaccinationStatusAtBooking)
  ) {
    return "vaccination_alert";
  }

  if (appointment.status === "confirmed" && appointment.customerConfirmedAt) {
    return "customer_yes";
  }

  return null;
}
