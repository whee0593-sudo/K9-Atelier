import type { AppointmentRecord } from "@/lib/appointments/types";

export type StaffStatusNoticeKind =
  | "confirmed"
  | "declined"
  | "staff_cancelled";

/** An accepted add-dog request needs its own confirmation after the original visit's notice. */
export function staffConfirmationEventKey(appointment: Pick<AppointmentRecord, "id" | "customerAddDogRequest">) {
  return appointment.customerAddDogRequest ? `staff_confirmed:add-dog:${appointment.id}` : "staff_confirmed";
}

/** Which customer notice to send after an admin status change. */
export function resolveStaffStatusNoticeKind(
  status: "confirmed" | "cancelled",
  previousStatus?: AppointmentRecord["status"],
): StaffStatusNoticeKind {
  if (status === "confirmed") return "confirmed";
  if (previousStatus === "confirmed") return "staff_cancelled";
  return "declined";
}
