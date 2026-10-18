import { snapshotServicePrice } from "@/lib/visits/visit";
import { attachBookingPriceSnapshot } from "@/lib/charges/visit-line-items";
import {
  bookedServiceAmount,
  estimateServiceDurationMinutes,
  getAvailableAddOns,
  isCatalogAddOnId,
  resolveAddOnCharges,
  allBookableServices,
  type BookableService,
} from "@/lib/services";
import { parseStaffServiceSelection } from "@/lib/staff/service-choice";

export type StaffDogPricingInput = {
  weightLbs: number;
  serviceIds: string[];
  serviceOptionNames: (string | null)[];
  servicePrices: (number | null)[];
  addOnIds: string[];
  addOnOptions: Record<string, string>;
};

export type StaffAppointmentPriceDraft = {
  dogIndex: number;
  serviceId: string;
  serviceName: string;
  optionName: string | null;
  servicePrice: number;
  addOnIds: string[];
  addOnOptions: Record<string, unknown>;
  travelFee: number;
  estimatedTotal: number;
  durationMinutes: number;
  visitSequence: number;
};

/** Add-ons stay on the dog's first primary service, not on every service row. */
export function staffAddOnCarrierIndex(serviceIds: readonly string[]) {
  const index = serviceIds.findIndex((id) => !isCatalogAddOnId(id));
  return index === -1 ? 0 : index;
}

export function selectableAddOnsForServiceIds(serviceIds: readonly string[]) {
  const primaries = serviceIds.filter((id) => id && !isCatalogAddOnId(id));
  if (primaries.length === 0) return [];
  let choices = getAvailableAddOns("", primaries[0] ?? "");
  for (const primary of primaries.slice(1)) {
    const allowed = new Set(getAvailableAddOns("", primary).map((service) => service.id));
    choices = choices.filter((service) => allowed.has(service.id));
  }
  return choices;
}

function pricedAddOnTotal(
  serviceId: string,
  addOnIds: readonly string[],
  weightLbs: number,
  addOnOptions: Record<string, string>,
) {
  return resolveAddOnCharges(serviceId, addOnIds, weightLbs, addOnOptions)
    .filter((charge) => charge.kind === "priced")
    .reduce((sum, charge) => sum + charge.amount, 0);
}

function serviceNameFor(service: BookableService, optionName: string | null) {
  return (
    (optionName
      ? parseStaffServiceSelection(`${service.id}::${optionName}`)?.label
      : null) || service.name
  );
}

/**
 * Price rows the staff booking writer stores.
 * Travel is charged once, on the first appointment of the visit.
 * Each dog's add-ons are stored only on that dog's carrier appointment.
 */
export function staffAppointmentPriceDrafts(
  pets: readonly StaffDogPricingInput[],
  travelFee: number,
):
  | { ok: true; drafts: StaffAppointmentPriceDraft[] }
  | { ok: false; message: string } {
  const drafts: StaffAppointmentPriceDraft[] = [];
  let visitIndex = 0;

  for (let dogIndex = 0; dogIndex < pets.length; dogIndex += 1) {
    const pet = pets[dogIndex];
    if (!pet) continue;
    const carrierIndex = staffAddOnCarrierIndex(pet.serviceIds);
    for (let serviceIndex = 0; serviceIndex < pet.serviceIds.length; serviceIndex += 1) {
      const serviceId = pet.serviceIds[serviceIndex];
      const service = allBookableServices().find((entry) => entry.id === serviceId);
      if (!service) return { ok: false, message: "Unknown service." };
      const carriesAddOns = serviceIndex === carrierIndex;
      const addOnIds = carriesAddOns ? pet.addOnIds : [];
      const optionName = pet.serviceOptionNames[serviceIndex] ?? null;
      const optionNames = carriesAddOns
        ? {
            ...pet.addOnOptions,
            ...(optionName ? { [service.id]: optionName } : {}),
          }
        : optionName
          ? { [service.id]: optionName }
          : {};
      const charges = carriesAddOns
        ? resolveAddOnCharges(service.id, addOnIds, pet.weightLbs, pet.addOnOptions)
        : [];
      if (charges.some((charge) => charge.kind === "unpriced")) {
        return { ok: false, message: "We could not price this add-on." };
      }
      const addOnOptions = attachBookingPriceSnapshot(
        optionNames,
        charges.flatMap((charge) =>
          charge.kind === "priced"
            ? [{ id: charge.id, label: charge.name, amount: charge.amount }]
            : [],
        ),
        charges.flatMap((charge) =>
          charge.kind === "assessed"
            ? [{ id: charge.id, label: charge.name, note: charge.note }]
            : [],
        ),
      );
      const price = bookedServiceAmount(
        service,
        pet.weightLbs,
        optionName,
        pet.servicePrices[serviceIndex] ?? null,
      );
      const servicePrice = snapshotServicePrice(price ?? 0);
      const rowTravel = visitIndex === 0 ? travelFee : 0;
      const addOnPrice = carriesAddOns
        ? pricedAddOnTotal(service.id, addOnIds, pet.weightLbs, pet.addOnOptions)
        : 0;
      drafts.push({
        dogIndex,
        serviceId: service.id,
        serviceName: serviceNameFor(service, optionName),
        optionName,
        servicePrice,
        addOnIds,
        addOnOptions,
        travelFee: rowTravel,
        estimatedTotal:
          Math.round((servicePrice + addOnPrice + rowTravel) * 100) / 100,
        durationMinutes: estimateServiceDurationMinutes(
          service.id,
          pet.weightLbs,
          addOnIds,
        ),
        visitSequence: visitIndex + 1,
      });
      visitIndex += 1;
    }
  }

  return { ok: true, drafts };
}
