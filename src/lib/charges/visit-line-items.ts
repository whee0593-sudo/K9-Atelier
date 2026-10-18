import { sanitizeLineItems } from "@/lib/charges/line-items";
import { sumLineItems } from "@/lib/charges/money";
import type { ChargeLineItem } from "@/lib/charges/types";

export const VISIT_LINE_ITEMS_KEY = "__visitLineItems";
/** New bookings store the main service only in service_price. */
export const SERVICE_PRICE_SCOPE_KEY = "__servicePriceScope";
/** Booking-time add-on amounts. Checkout must not reprice these from the catalog. */
export const PRICED_ADD_ONS_KEY = "__pricedAddOns";
/**
 * Guest bookings set this so cancellation fees still include add-ons after
 * service_price stopped storing them. Staff bookings leave it unset.
 */
export const FEE_INCLUDES_ADD_ONS_KEY = "__feeIncludesAddOns";

function isReservedAddOnKey(key: string) {
  return key.startsWith("__");
}

export function stringAddOnOptions(
  value: Record<string, unknown> | null | undefined,
) {
  const options: Record<string, string> = {};
  if (!value) return options;
  for (const [key, item] of Object.entries(value)) {
    if (isReservedAddOnKey(key)) continue;
    if (typeof item === "string" && item.trim()) options[key] = item;
  }
  return options;
}

function preservedPriceSnapshot(
  value: Record<string, unknown> | null | undefined,
) {
  const snapshot: Record<string, unknown> = {};
  if (!value) return snapshot;
  for (const [key, item] of Object.entries(value)) {
    if (!isReservedAddOnKey(key) || key === VISIT_LINE_ITEMS_KEY) continue;
    snapshot[key] = item;
  }
  return snapshot;
}

export function readStoredVisitLineItems(
  value: Record<string, unknown> | null | undefined,
) {
  return sanitizeLineItems(value?.[VISIT_LINE_ITEMS_KEY]) ?? null;
}

function catalogServiceId(catalogId?: string) {
  if (!catalogId || catalogId === "travel-fee" || catalogId === "no-show") {
    return null;
  }
  return catalogId.split("::")[0] || null;
}

export function appointmentFieldsFromVisitLineItems(items: ChargeLineItem[]) {
  const serviceItems = items.filter((item) => catalogServiceId(item.catalogId));
  const travel = items.find((item) => item.catalogId === "travel-fee");
  const primary = serviceItems[0];
  const primaryCatalog = primary?.catalogId ?? "";
  const [serviceId, optionName] = primaryCatalog.includes("::")
    ? primaryCatalog.split("::")
    : [primaryCatalog, undefined];
  const addOnOptions = stringAddOnOptions(null);
  if (serviceId && optionName) addOnOptions[serviceId] = optionName;

  const addOnIds: string[] = [];
  for (const item of serviceItems.slice(1)) {
    const catalog = item.catalogId ?? "";
    const id = catalogServiceId(catalog);
    if (!id) continue;
    addOnIds.push(id);
    if (catalog.includes("::")) {
      const option = catalog.split("::")[1];
      if (option) addOnOptions[id] = option;
    }
  }

  return {
    serviceId: serviceId || primary?.catalogId || "",
    serviceName: primary?.label ?? items[0]?.label ?? "Service",
    addOnIds,
    addOnOptions,
    travelFee: travel?.amount ?? 0,
    estimatedTotal: Math.round(sumLineItems(items) * 100) / 100,
  };
}

export function mergeVisitLineItemsIntoOptions(
  current: Record<string, unknown> | null | undefined,
  items: ChargeLineItem[],
) {
  const fields = appointmentFieldsFromVisitLineItems(items);
  return {
    ...preservedPriceSnapshot(current),
    ...stringAddOnOptions(current),
    ...fields.addOnOptions,
    [VISIT_LINE_ITEMS_KEY]: items,
  };
}
