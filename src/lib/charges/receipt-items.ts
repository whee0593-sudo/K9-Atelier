import type { AppointmentChargeRecord, ChargeLineItem } from "./types";
import { getCatalogItemDisplayLabel } from "../service-display";

/** Paid line items include checkout additions that the pet snapshot can omit. */
export function receiptItems(charge: AppointmentChargeRecord, petName?: string) {
  const snapshot = charge.billSnapshot;
  const items: ChargeLineItem[] = charge.lineItems.length ? charge.lineItems :
    (snapshot ? [
      ...snapshot.pets.map((pet, index) => ({
        id: "pet-" + index, label: pet.serviceName, amount: pet.amount,
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
    rows.push({ id: "subtotal", label: "Subtotal", amount: snapshot.subtotal });
  }
  return rows;
}
