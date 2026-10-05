import type { AppointmentStatus } from "@/lib/appointments/types";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

export type AppointmentCornerKind = "customer_yes" | null;

type MarkInput = {
  status: AppointmentStatus;
  vaccinationStatusAtBooking?: VaccinationBookingStatus | null;
  customerConfirmedAt?: string | null;
  awaitingCustomerConfirm?: boolean;
};

/**
 * Rabies documents are optional and do not block a booking, so the calendar
 * does not flag vaccination status. Customer reply C is a confirm mark, only
 * after the booking succeeded.
 */
export function appointmentCornerMark(appointment: MarkInput): AppointmentCornerKind {
  if (appointment.awaitingCustomerConfirm) {
    return null;
  }

  if (appointment.status === "confirmed" && appointment.customerConfirmedAt) {
    return "customer_yes";
  }

  return null;
}
