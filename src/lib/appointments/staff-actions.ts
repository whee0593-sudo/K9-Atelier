import type { AdminAppointmentRecord } from "@/lib/appointments/types";

type StaffActionAppointment = Pick<AdminAppointmentRecord, "status">;

/** Staff can move any calendar booking that is not already cancelled. */
export function canStaffRescheduleAppointment(
  appointment: StaffActionAppointment,
): boolean {
  return canStaffCancelAppointment(appointment);
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
