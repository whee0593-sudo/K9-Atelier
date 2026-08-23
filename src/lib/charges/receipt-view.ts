import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export function formatReceiptDate(date: string | null | undefined) {
  if (!date) return null;
  const parsed = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatReceiptTime(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return trimmed;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export function formatReceiptPaymentDate(
  value: string | null | undefined,
  timeZone?: string,
) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone || "America/New_York",
  });
}

export function formatReceiptPaymentMethod(
  method: PaymentMethodRecord | null | undefined,
) {
  if (!method?.last4) return null;
  const brand = method.brand?.trim()
    ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1)
    : "Card";
  return `${brand} ending in ${method.last4}`;
}

export function receiptCustomerFirstName(appointment: AdminAppointmentRecord) {
  const first = appointment.customerFirstName?.trim();
  if (first) return first;
  const full = appointment.customerName?.trim();
  if (!full) return null;
  return full.split(/\s+/)[0] ?? null;
}

export function appointmentCustomerLastName(
  appointment: AdminAppointmentRecord,
) {
  const last = appointment.customerLastName?.trim();
  if (last) return last;
  const full = appointment.customerName?.trim();
  const first = appointment.customerFirstName?.trim();
  if (full && first && full.toLowerCase().startsWith(first.toLowerCase())) {
    const rest = full.slice(first.length).trim();
    if (rest) return rest;
  }
  if (!full) return null;
  const parts = full.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : null;
}

export function collectBillHeading(appointment: AdminAppointmentRecord) {
  const pet = appointment.petName?.trim() || "Guest";
  const last = appointmentCustomerLastName(appointment);
  return last ? `${pet} ${last}` : pet;
}

export function receiptPaymentStatus(charge: AppointmentChargeRecord) {
  if (charge.status === "paid") return "Paid";
  return null;
}
