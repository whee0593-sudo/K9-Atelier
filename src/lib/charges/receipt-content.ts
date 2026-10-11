import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { formatLineItemMoney } from "@/lib/charges/list-amount";
import { formatChargeMoney } from "@/lib/charges/money";
import { formatReceiptServiceTime } from "@/lib/charges/receipt-view";
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
  if (kind === "no_show") return "No-show";
  if (kind === "cancellation") return "Cancellation";
  return "Grooming";
}

export function buildChargeReceiptParagraphs(
  appointment: AdminAppointmentRecord,
  charge: AppointmentChargeRecord,
) {
  const kindLabel = chargeKindLabel(charge.kind);
  const snapshot = charge.billSnapshot;
  const itemLines = snapshot
    ? [
        ...snapshot.pets.map(
          (pet) =>
            `${pet.petName} — ${pet.serviceName}  ${formatChargeMoney(pet.amount)}`,
        ),
        snapshot.travelFee > 0
          ? `Travel fee  ${formatChargeMoney(snapshot.travelFee)}`
          : "",
        snapshot.discount > 0
          ? `Discount  ${formatChargeMoney(-snapshot.discount)}`
          : "",
        `Subtotal  ${formatChargeMoney(snapshot.subtotal)}`,
      ].filter(Boolean)
    : charge.lineItems.map(
        (item) =>
          `${getCatalogItemDisplayLabel(item.catalogId, item.label)}  ${formatLineItemMoney(item)}`,
      );
  const remaining =
    Math.round((charge.total - (charge.refundedAmount ?? 0)) * 100) / 100;
  const refunded = charge.refundedAmount ?? 0;

  return [
    snapshot
      ? `Thank you for trusting K9 Atelier. Here is your ${kindLabel.toLowerCase()} receipt.`
      : `Thank you for trusting K9 Atelier with ${appointment.petName}. Here is your ${kindLabel.toLowerCase()} receipt.`,
    snapshot
      ? `${formatReceiptDate(snapshot.serviceDate)} · ${snapshot.arrivalLabel}`
      : `${formatReceiptDate(appointment.appointmentDate)} · ${formatReceiptServiceTime(appointment) ?? appointment.appointmentTime}`,
    ...itemLines,
    charge.tipAmount > 0 ? `Tip  ${formatChargeMoney(charge.tipAmount)}` : "",
    `Total paid  ${formatChargeMoney(charge.total)}`,
    refunded > 0 ? `Refunded  ${formatChargeMoney(refunded)}` : "",
    refunded > 0 ? `Remaining  ${formatChargeMoney(remaining)}` : "",
    snapshot?.paymentMethodLabel
      ? `Payment method  ${snapshot.paymentMethodLabel}`
      : "",
  ].filter(Boolean);
}

export function chargeReceiptGreeting(appointment: AdminAppointmentRecord) {
  return appointment.customerFirstName || "there";
}
