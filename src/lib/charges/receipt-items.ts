import type { AppointmentChargeRecord, ChargeLineItem } from "./types";
import { getCatalogItemDisplayLabel } from "../service-display";

/** Paid line items include checkout additions that the pet snapshot can omit. */
export function receiptItems(charge: AppointmentChargeRecord, petName?: string) {
  const snapshot = charge.billSnapshot;
  const items: ChargeLineItem[] = charge.lineItems.length ? charge.lineItems :
    (snapshot ? [
      ...snapshot.pets.map((pet, index) => ({
        id: "pet-" + index, label: pet.serviceName, amount: pet.amount, appointmentId: pet.appointmentId, petName: pet.petName,
      })),
      ...(snapshot.travelFee > 0 ? [{ id: "travel", label: "Travel fee", amount: snapshot.travelFee }] : []),
    ] : []);
  const names = [petName, ...(snapshot?.pets.map((pet) => pet.petName) ?? [])];
  const rows = items.map((item) => {
    let label = item.label;
    for (const name of [item.petName, ...names]) {
      if (!name) continue;
      const prefix = name.trim() + " — ";
      if (label.startsWith(prefix)) {
        label = label.slice(prefix.length);
        break;
      }
    }
    return { ...item, label: getCatalogItemDisplayLabel(item.catalogId, label) };
  });
  if (snapshot) {
    if (snapshot.discount > 0) rows.push({ id: "discount", label: "Discount", amount: -snapshot.discount });

  }
  rows.push({ id: "subtotal", label: "Subtotal", amount: snapshot?.subtotal ?? charge.subtotal });
  return rows;
}

/** Group by dog appointment, leaving travel, totals and unassigned charges separate. */
export function groupChargeItems(items: ChargeLineItem[], pets?: Array<{ id: string; petName: string }>, fallbackPetName?: string) {
  const groups = new Map<string, { petName: string; items: ChargeLineItem[] }>();
  for (const item of items) {
    const shared = ["travel-fee"].includes(item.catalogId ?? "") || ["subtotal", "discount", "referral-credit"].includes(item.id);
    const petName = shared ? "" : item.petName || pets?.find(pet => pet.id === item.appointmentId)?.petName || fallbackPetName || "";
    const key = shared ? "line:" + item.id : item.appointmentId ? "pet:" + item.appointmentId : petName ? "name:" + petName : "line:" + item.id;
    const group = groups.get(key) ?? { petName, items: [] };
    const prefix = petName + " — ";
    group.items.push({ ...item, label: getCatalogItemDisplayLabel(item.catalogId, petName && item.label.startsWith(prefix) ? item.label.slice(prefix.length) : item.label) });
    groups.set(key, group);
  }
  return [...groups.values()];
}
