import { randomUUID } from "crypto";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  allBookableServices,
  getAddOnService,
  getServicePriceEstimate,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import { resolveReferralCategory } from "@/lib/referrals/eligible";
import type { ChargeLineItem } from "@/lib/charges/types";

export { catalogChargeItems, catalogChargeGroups } from "@/lib/charges/catalog";

export function buildDefaultLineItems(
  appointment: AppointmentRecord,
  weightLbs: number,
): ChargeLineItem[] {
  const items: ChargeLineItem[] = [];
  const primary = allBookableServices().find(
    (service) => service.id === appointment.serviceId,
  );
  const primaryPrice = primary
    ? getServicePriceEstimate(primary, weightLbs)?.from
    : null;

  items.push({
    id: randomUUID(),
    label: getServiceDisplayName(appointment.serviceId, appointment.serviceName),
    amount: Number(primaryPrice ?? appointment.estimatedTotal ?? 0),
    catalogId: appointment.serviceId,
    referralCategory: "eligible_service",
  });

  for (const addOnId of appointment.addOnIds) {
    const addOn = getAddOnService(addOnId);
    const optionName = appointment.addOnOptions[addOnId];
    const estimate = addOn
      ? getServicePriceEstimate(addOn, weightLbs, optionName)
      : null;
    items.push({
      id: randomUUID(),
      label: addOn
        ? getServiceDisplayName(addOn.id, addOn.name)
        : addOnId,
      amount: Number(estimate?.from ?? 0),
      catalogId: addOnId,
      referralCategory: "eligible_service",
    });
  }

  if (appointment.travelFee > 0) {
    items.push({
      id: randomUUID(),
      label: "Travel fee",
      amount: Number(appointment.travelFee),
      catalogId: "travel-fee",
      referralCategory: "travel_fee",
    });
  }

  return items;
}

export function buildNoShowLineItems(appointment: AppointmentRecord): ChargeLineItem[] {
  return [
    {
      id: randomUUID(),
      label: "No-show fee",
      amount: Number(appointment.estimatedTotal ?? 0),
      catalogId: "no-show",
      referralCategory: "other_ineligible",
    },
  ];
}

export function sanitizeLineItems(items: unknown): ChargeLineItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    return null;
  }

  const sanitized: ChargeLineItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const label = String(record.label ?? "").trim();
    const amount = Number(record.amount);
    if (!label || label.length > 80) return null;
    if (!Number.isFinite(amount) || amount < 0 || amount > 5000) return null;
    sanitized.push({
      id: String(record.id ?? randomUUID()),
      label,
      amount: Math.round(amount * 100) / 100,
      catalogId:
        typeof record.catalogId === "string" ? record.catalogId : undefined,
      referralCategory: resolveReferralCategory({
        catalogId:
          typeof record.catalogId === "string" ? record.catalogId : undefined,
        referralCategory:
          record.referralCategory === "eligible_service" ||
          record.referralCategory === "travel_fee" ||
          record.referralCategory === "special_handling" ||
          record.referralCategory === "gratuity" ||
          record.referralCategory === "other_ineligible"
            ? record.referralCategory
            : undefined,
      }),
    });
  }
  return sanitized;
}
