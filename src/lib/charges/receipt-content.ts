import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { formatChargeMoney } from "@/lib/charges/money";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import { getCatalogItemDisplayLabel } from "@/lib/service-display";

function formatReceiptDate(date: string) {
  const parsed = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function chargeKindLabel(kind: AppointmentChargeRecord["kind"]) {
  return kind === "no_show" ? "No-show" : "Grooming";
}

export function buildChargeReceiptParagraphs(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  const kindLabel = chargeKindLabel(charge.kind);
  const itemLines = charge.lineItems.map(
    (item) =>
      `${getCatalogItemDisplayLabel(item.catalogId, item.label)}  ${formatChargeMoney(item.amount)}`,
  );
  const remaining =
    Math.round((charge.total - (charge.refundedAmount ?? 0)) * 100) / 100;
  const refunded = charge.refundedAmount ?? 0;

  return [
    `Thank you for trusting K9 Atelier with ${appointment.petName}. Here is your ${kindLabel.toLowerCase()} receipt.`,
    `${formatReceiptDate(appointment.appointmentDate)} · ${appointment.appointmentTime}`,
    ...itemLines,
    charge.tipAmount > 0 ? `Tip  ${formatChargeMoney(charge.tipAmount)}` : "",
    `Total paid  ${formatChargeMoney(charge.total)}`,
    refunded > 0 ? `Refunded  ${formatChargeMoney(refunded)}` : "",
    refunded > 0 ? `Remaining  ${formatChargeMoney(remaining)}` : "",
  ].filter(Boolean);
}

export function chargeReceiptGreeting(appointment: AdminAppointmentRecord) {
  return appointment.customerFirstName || "there";
}
