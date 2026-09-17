import type { AdminAppointmentRecord } from "@/lib/appointments/types";

type StaffActionAppointment = Pick<
  AdminAppointmentRecord,
  "status" | "serviceStartedAt" | "serviceEndedAt"
>;

/** Staff can move a calendar booking that has not started yet. */
export function canStaffRescheduleAppointment(
  appointment: StaffActionAppointment,
): boolean {
  if (appointment.status === "cancelled") return false;
  if (appointment.serviceStartedAt || appointment.serviceEndedAt) return false;
  return (
    appointment.status === "confirmed" ||
    appointment.status === "pending_confirmation"
  );
}

/** Staff can cancel any open calendar booking that is not already cancelled. */
export function canStaffCancelAppointment(
  appointment: Pick<StaffActionAppointment, "status">,
): boolean {
  return (
    appointment.status === "confirmed" ||
    appointment.status === "pending_confirmation"
  );
}
