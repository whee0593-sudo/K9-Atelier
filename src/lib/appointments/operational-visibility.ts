import type { AppointmentStatus } from "@/lib/appointments/types";

/** Operational admin day/drive views exclude cancelled appointments. */
export function isOperationalAdminAppointment(status: AppointmentStatus) {
  return status !== "cancelled";
}
