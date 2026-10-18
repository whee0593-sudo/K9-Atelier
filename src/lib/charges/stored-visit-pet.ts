import { bookingWeightLbs } from "@/lib/pets/weight";
import { resolveAddOnCharges } from "@/lib/services";
import {
  readStoredVisitLineItems,
  stringAddOnOptions,
} from "@/lib/charges/visit-line-items";
import type { VisitCheckoutPet } from "@/lib/charges/visit-bill";

export type StoredVisitAppointment = {
  id: string;
  status: string;
  serviceName: string;
  serviceId: string;
  /** Primary service amount only. Add-ons are billed from add_on_ids. */
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

/**
 * Default visit pet from the appointment row the booking writer stored.
 * Priced add-ons are added once from the catalog. An admin-saved line
 * replaces that catalog amount. Custom care lines are kept. Unquoted
 * Gentle DeMatting does not become a $0 line.
 */
export function visitCheckoutPetFromStoredAppointment(
  row: StoredVisitAppointment,
): VisitCheckoutPet {
  const weight = bookingWeightLbs(row.weightLbs);
  const stored = readStoredVisitLineItems(row.addOnOptions) ?? [];
  const priced =
    weight == null
      ? []
      : resolveAddOnCharges(
          row.serviceId,
          row.addOnIds,
          weight,
          stringAddOnOptions(row.addOnOptions),
        ).flatMap((charge) => (charge.kind === "priced" ? [charge] : []));

  const addOns: Array<{ label: string; amount: number; catalogId?: string }> =
    priced.map((charge) => {
      const saved = stored.find(
        (item) => catalogIdOf(item.catalogId) === charge.id,
      );
      return {
        label: saved?.label?.trim() || charge.name,
        amount: saved ? saved.amount : charge.amount,
        catalogId: charge.id,
      };
    });

  const seen = new Set(addOns.map((item) => item.catalogId).filter(Boolean));
  for (const item of stored) {
    const catalogId = catalogIdOf(item.catalogId);
    if (catalogId === row.serviceId) continue;
    if (catalogId && seen.has(catalogId)) continue;
    if (!(item.amount > 0)) continue;
    if (catalogId) seen.add(catalogId);
    addOns.push({
      label: item.label,
      amount: item.amount,
      ...(item.catalogId ? { catalogId: catalogId ?? item.catalogId } : {}),
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
  };
}
