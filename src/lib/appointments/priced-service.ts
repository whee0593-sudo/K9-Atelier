import {
  FEE_INCLUDES_ADD_ONS_KEY,
  PRICED_ADD_ONS_KEY,
  SERVICE_PRICE_SCOPE_KEY,
  readStoredVisitLineItems,
  stringAddOnOptions,
} from "@/lib/charges/visit-line-items";
import type { BookingPriceQuote } from "@/lib/booking-price";
import {
  CREATIVE_ACCENT_COLORING_ID,
  getAddOnService,
  getServicePriceEstimate,
  type BookableService,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import { snapshotServicePrice } from "@/lib/visits/visit";

export type PricedAddOn = {
  id: string;
  label: string;
  amount: number;
};

export type CheckoutAddOnLine = {
  label: string;
  amount: number;
  catalogId?: string;
};

export type StoredAppointmentPrice = {
  serviceId?: string | null;
  serviceName?: string | null;
  servicePrice: number | null;
  addOnIds?: string[] | null;
  addOnOptions?: Record<string, unknown> | null;
  weightLbs?: number | null;
};

function money(amount: number) {
  return Math.round(amount * 100) / 100;
}

function sameMoney(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

export function readPricedAddOns(
  options: Record<string, unknown> | null | undefined,
): PricedAddOn[] | null {
  const raw = options?.[PRICED_ADD_ONS_KEY];
  if (!Array.isArray(raw)) return null;
  const priced: PricedAddOn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const amount = Number(record.amount);
    if (!id || !label || !Number.isFinite(amount) || amount < 0) return null;
    priced.push({ id, label, amount: money(amount) });
  }
  return priced;
}

export function feeIncludesStoredAddOns(
  options: Record<string, unknown> | null | undefined,
) {
  return options?.[FEE_INCLUDES_ADD_ONS_KEY] === true;
}

export function servicePriceIsBaseOnly(
  options: Record<string, unknown> | null | undefined,
) {
  return options?.[SERVICE_PRICE_SCOPE_KEY] === "base";
}

export function attachServicePriceSnapshot(
  optionNames: Record<string, string>,
  addOns: PricedAddOn[],
  feeIncludesAddOns: boolean,
) {
  return {
    ...stringAddOnOptions(optionNames),
    [SERVICE_PRICE_SCOPE_KEY]: "base",
    [PRICED_ADD_ONS_KEY]: addOns.map((addOn) => ({
      id: addOn.id,
      label: addOn.label,
      amount: money(addOn.amount),
    })),
    ...(feeIncludesAddOns ? { [FEE_INCLUDES_ADD_ONS_KEY]: true } : {}),
  };
}

/** Guest online booking: service_price is the main service. The quoted total stays unchanged. */
export function guestAppointmentPriceFields(
  quote: BookingPriceQuote,
  addOnOptions: Record<string, string>,
) {
  const addOns: PricedAddOn[] = quote.addOns.map((addOn) => ({
    id: addOn.id,
    label: addOn.name,
    amount: addOn.price,
  }));
  return {
    servicePrice: snapshotServicePrice(quote.servicePrice),
    estimatedTotal: quote.estimatedTotal,
    addOnIds: addOns.map((addOn) => addOn.id),
    addOnOptions: attachServicePriceSnapshot(addOnOptions, addOns, true),
  };
}

function isCatalogAddOn(service: BookableService) {
  return (
    !service.bookableAsPrimary || service.id === CREATIVE_ACCENT_COLORING_ID
  );
}

export function priceAddOnSnapshots(
  addOnIds: string[],
  addOnOptions: Record<string, string>,
  weightLbs: number,
): { ok: true; addOns: PricedAddOn[] } | { ok: false; message: string } {
  const addOns: PricedAddOn[] = [];
  for (const id of addOnIds) {
    const addOn = getAddOnService(id);
    if (!addOn || !isCatalogAddOn(addOn)) {
      return { ok: false, message: "That add-on cannot be booked with this service." };
    }
    const optionName = addOnOptions[id];
    const estimate = getServicePriceEstimate(addOn, weightLbs, optionName);
    if (estimate == null) {
      return { ok: false, message: "We could not price this add-on." };
    }
    addOns.push({
      id,
      label: getServiceDisplayName(addOn.id, addOn.name),
      amount: money(estimate.from),
    });
  }
  return { ok: true, addOns };
}

/**
 * Staff rows keep service_price as the main service. Add-ons are stored beside it.
 * estimated_total stays service plus this row's travel fee, so cancellation
 * previews that read the stored total keep the service-only staff policy.
 */
export function staffServicePriceFields(input: {
  serviceId: string;
  servicePrice: number;
  travelFee: number;
  weightLbs: number;
  optionName: string | null;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  includeAddOns: boolean;
}):
  | {
      ok: true;
      servicePrice: number;
      estimatedTotal: number;
      addOnIds: string[];
      addOnOptions: Record<string, unknown>;
    }
  | { ok: false; message: string } {
  const names: Record<string, string> = {};
  if (input.optionName) names[input.serviceId] = input.optionName;
  const attach =
    input.includeAddOns && input.addOnIds.length > 0
      ? priceAddOnSnapshots(input.addOnIds, input.addOnOptions, input.weightLbs)
      : { ok: true as const, addOns: [] as PricedAddOn[] };
  if (!attach.ok) return attach;
  for (const addOn of attach.addOns) {
    const value = input.addOnOptions[addOn.id];
    if (value && !names[addOn.id]) names[addOn.id] = value;
  }
  return {
    ok: true,
    servicePrice: input.servicePrice,
    estimatedTotal: money(input.servicePrice + input.travelFee),
    addOnIds: attach.addOns.map((addOn) => addOn.id),
    addOnOptions: attachServicePriceSnapshot(names, attach.addOns, false),
  };
}

/**
 * Amount used for cancellation and reschedule fees.
 * Legacy rows keep service_price, which already includes add-ons for guest bookings.
 * New guest rows add the frozen add-on snapshot back. Staff rows do not.
 */
export function cancellationServicePortion(row: {
  service_price?: number | null;
  estimated_total?: number | null;
  travel_fee?: number | null;
  add_on_options?: Record<string, unknown> | null;
}) {
  const options = row.add_on_options ?? null;
  const base =
    row.service_price != null && Number.isFinite(Number(row.service_price))
      ? Number(row.service_price)
      : null;
  if (base == null) {
    const estimated =
      row.estimated_total == null ? null : Number(row.estimated_total);
    const travel = Number(row.travel_fee ?? 0);
    if (estimated == null || !Number.isFinite(estimated)) return 0;
    if (travel > 0 && estimated >= travel) return money(estimated - travel);
    return money(estimated);
  }
  if (!feeIncludesStoredAddOns(options)) return money(base);
  const addOns = readPricedAddOns(options) ?? [];
  return money(base + addOns.reduce((sum, addOn) => sum + addOn.amount, 0));
}

/** Service dollars that belong in estimated_total before the travel fee. */
export function estimatedServicePortion(row: {
  service_price?: number | null;
  estimated_total?: number | null;
  travel_fee?: number | null;
  add_on_options?: Record<string, unknown> | null;
}) {
  const options = row.add_on_options ?? null;
  const base =
    row.service_price != null && Number.isFinite(Number(row.service_price))
      ? Number(row.service_price)
      : null;
  if (base == null) return cancellationServicePortion(row);
  const addOns = readPricedAddOns(options) ?? [];
  if (servicePriceIsBaseOnly(options)) {
    return money(base + addOns.reduce((sum, addOn) => sum + addOn.amount, 0));
  }
  return money(base);
}

function catalogAddOnLines(
  addOnIds: string[],
  addOnOptions: Record<string, string>,
  weightLbs: number,
): CheckoutAddOnLine[] {
  return addOnIds.map((addOnId) => {
    const addOn = getAddOnService(addOnId);
    const optionName = addOnOptions[addOnId];
    const estimate = addOn
      ? getServicePriceEstimate(addOn, weightLbs, optionName)
      : null;
    return {
      label: addOn ? getServiceDisplayName(addOn.id, addOn.name) : addOnId,
      amount: money(Number(estimate?.from ?? 0)),
      catalogId: addOnId,
    };
  });
}

/**
 * Legacy guest rows stored add-ons inside service_price. Legacy staff rows did not.
 * When the catalog still matches, only the staff shape gets separate add-on lines.
 * Anything else keeps the stored service_price and does not add the catalog again.
 */
function legacyAddOnLines(row: StoredAppointmentPrice): CheckoutAddOnLine[] {
  const addOnIds = row.addOnIds ?? [];
  const weight = row.weightLbs;
  const servicePrice = row.servicePrice;
  if (addOnIds.length === 0 || weight == null || servicePrice == null) return [];
  const service = row.serviceId ? getAddOnService(row.serviceId) : null;
  const base = service
    ? getServicePriceEstimate(service, weight)?.from
    : null;
  if (base == null) return [];
  const optionNames = stringAddOnOptions(row.addOnOptions);
  const lines = catalogAddOnLines(addOnIds, optionNames, weight);
  const addOnSum = lines.reduce((sum, line) => sum + line.amount, 0);
  if (sameMoney(servicePrice, base)) return lines;
  if (sameMoney(servicePrice, base + addOnSum)) return [];
  return [];
}

export function checkoutPetFromStoredRow(row: StoredAppointmentPrice): {
  serviceName: string | null;
  servicePrice: number | null;
  addOns: CheckoutAddOnLine[];
} {
  const options = row.addOnOptions ?? null;
  const stored = readStoredVisitLineItems(options);
  if (stored) {
    const lines = stored.filter((item) => item.catalogId !== "travel-fee");
    const first = lines[0];
    if (first) {
      return {
        serviceName: first.label,
        servicePrice: money(first.amount),
        addOns: lines.slice(1).map((item) => ({
          label: item.label,
          amount: money(item.amount),
          catalogId: item.catalogId,
        })),
      };
    }
  }

  const priced = readPricedAddOns(options);
  if (priced && servicePriceIsBaseOnly(options)) {
    return {
      serviceName: row.serviceName ?? null,
      servicePrice: row.servicePrice,
      addOns: priced.map((addOn) => ({
        label: addOn.label,
        amount: addOn.amount,
        catalogId: addOn.id,
      })),
    };
  }

  return {
    serviceName: row.serviceName ?? null,
    servicePrice: row.servicePrice,
    addOns: legacyAddOnLines(row),
  };
}
