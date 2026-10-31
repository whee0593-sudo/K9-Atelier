import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChargeRecord } from "./types";

type ReceiptDependencies = {
  loadAppointment: (id: string) => Promise<AdminAppointmentRecord | null>;
  sendReceipt: (appointment: AdminAppointmentRecord, charge: AppointmentChargeRecord, paymentMethodLabel?: string | null) => Promise<boolean>;
  markSent: (id: string) => Promise<void>;
};

/** Receipt failures must never turn a completed payment into a failed checkout. */
export async function sendAutomaticReceipt(charge: AppointmentChargeRecord, deps: ReceiptDependencies) {
  if (charge.status !== "paid" || charge.receiptChannel === "email") return false;
  try {
    const appointment = await deps.loadAppointment(charge.appointmentId);
    if (!appointment?.customerEmail?.trim()) return false;
    const sent = await deps.sendReceipt(appointment, charge, charge.billSnapshot?.paymentMethodLabel);
    if (!sent) {
      console.error("automatic receipt email was not accepted:", charge.id);
      return false;
    }
    await deps.markSent(charge.id);
    charge.receiptChannel = "email";
    return true;
  } catch (error) {
    console.error("automatic receipt email failed:", charge.id, error);
    return false;
  }
}
