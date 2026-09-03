import type { AppointmentRecord } from "@/lib/appointments/types";

export type StaffStatusNoticeKind =
  | "confirmed"
  | "declined"
  | "staff_cancelled";

/** Which customer notice to send after an admin status change. */
export function resolveStaffStatusNoticeKind(
  status: "confirmed" | "cancelled",
  previousStatus?: AppointmentRecord["status"],
): StaffStatusNoticeKind {
  if (status === "confirmed") return "confirmed";
  if (previousStatus === "confirmed") return "staff_cancelled";
  return "declined";
}
