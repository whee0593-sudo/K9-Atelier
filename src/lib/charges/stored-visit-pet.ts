import {
  readAssessedAddOns,
  readPricedAddOns,
  readStoredVisitLineItems,
  servicePriceIsBaseOnly,
} from "@/lib/charges/visit-line-items";
import type { VisitCheckoutPet } from "@/lib/charges/visit-bill";

export type StoredVisitAppointment = {
  id: string;
  status: string;
  serviceName: string;
  serviceId: string;
  /** Primary service amount when the row is known to store the main service only. */
  servicePrice: number | null;
  serviceEndedAt: string | null;
  addOnIds: string[];
  addOnOptions: Record<string, unknown> | null;
  petName: string;
  weightLbs: number | null;
};

function catalogIdOf(catalogId?: string) {
  if (!catalogId || catalogId === "travel-fee" || catalogId === "no-show") {
    return null;
  }
  return catalogId.split("::")[0] || null;
}

export type CheckoutAddOnLine = {
  label: string;
  amount: number;
  catalogId?: string;
};

function money(amount: number) {
  return Math.round(amount * 100) / 100;
}

function linesFromSavedBill(
  row: StoredVisitAppointment,
  stored: NonNullable<ReturnType<typeof readStoredVisitLineItems>>,
): { serviceName: string; servicePrice: number; addOns: CheckoutAddOnLine[] } | null {
  const serviceLines = stored.filter((item) => {
    if (item.catalogId === "travel-fee" || item.catalogId === "no-show") return false;
    return true;
  });
  const first = serviceLines[0];
  if (!first || !(first.amount > 0)) return null;
  const addOns: CheckoutAddOnLine[] = [];
  for (const item of serviceLines.slice(1)) {
    if (!(item.amount > 0)) continue;
    const catalogId = catalogIdOf(item.catalogId);
    addOns.push({
      label: item.label,
      amount: money(item.amount),
      ...(catalogId ? { catalogId } : item.catalogId ? { catalogId: item.catalogId } : {}),
    });
  }
  return {
    serviceName: first.label.trim() || row.serviceName,
    servicePrice: money(first.amount),
    addOns,
  };
}

/**
 * Bill one stored appointment without guessing.
 * Saved lines win. A booking snapshot wins over the live catalog.
 * A row with no add-ons bills the stored service price.
 * Any other mix of service_price and add_on_ids waits for a person.
 */
export function visitCheckoutPetFromStoredAppointment(
  row: StoredVisitAppointment,
): VisitCheckoutPet {
  const stored = readStoredVisitLineItems(row.addOnOptions);
  if (stored) {
    const confirmed = linesFromSavedBill(row, stored);
    if (confirmed) {
      return {
        appointmentId: row.id,
        petName: row.petName.trim() || "Dog",
        serviceName: confirmed.serviceName,
        servicePrice: confirmed.servicePrice,
        status: row.status,
        serviceEndedAt: row.serviceEndedAt,
        addOns: confirmed.addOns,
        priceReviewRequired: false,
      };
    }
  }

  const options = row.addOnOptions;
  if (servicePriceIsBaseOnly(options)) {
    const priced = readPricedAddOns(options);
    const assessed = readAssessedAddOns(options);
    if (priced && assessed) {
      const seen = new Set<string>();
      const addOns: CheckoutAddOnLine[] = [];
      for (const addOn of priced) {
        if (seen.has(addOn.id) || !(addOn.amount > 0)) continue;
        seen.add(addOn.id);
        addOns.push({
          label: addOn.label,
          amount: addOn.amount,
          catalogId: addOn.id,
        });
      }
      return {
        appointmentId: row.id,
        petName: row.petName.trim() || "Dog",
        serviceName: row.serviceName,
        servicePrice: row.servicePrice,
        status: row.status,
        serviceEndedAt: row.serviceEndedAt,
        addOns,
        priceReviewRequired: false,
      };
    }
  }

  if (row.addOnIds.length === 0) {
    return {
      appointmentId: row.id,
      petName: row.petName.trim() || "Dog",
      serviceName: row.serviceName,
      servicePrice: row.servicePrice,
      status: row.status,
      serviceEndedAt: row.serviceEndedAt,
      addOns: [],
      priceReviewRequired: false,
    };
  }

  return {
    appointmentId: row.id,
    petName: row.petName.trim() || "Dog",
    serviceName: row.serviceName,
    servicePrice: row.servicePrice,
    status: row.status,
    serviceEndedAt: row.serviceEndedAt,
    addOns: [],
    priceReviewRequired: true,
  };
}
