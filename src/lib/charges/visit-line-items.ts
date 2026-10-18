import { sanitizeLineItems } from "@/lib/charges/line-items";
import { sumLineItems } from "@/lib/charges/money";
import type { ChargeLineItem } from "@/lib/charges/types";

export const VISIT_LINE_ITEMS_KEY = "__visitLineItems";
export const SERVICE_PRICE_SCOPE_KEY = "__servicePriceScope";
export const PRICED_ADD_ONS_KEY = "__pricedAddOns";
export const ASSESSED_ADD_ONS_KEY = "__assessedAddOns";

export type PricedAddOnSnapshot = {
  id: string;
  label: string;
  amount: number;
};

export type AssessedAddOnSnapshot = {
  id: string;
  label: string;
  note: string;
};

function money(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function isReservedAddOnKey(key: string) {
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

export function servicePriceIsBaseOnly(
  value: Record<string, unknown> | null | undefined,
) {
  return value?.[SERVICE_PRICE_SCOPE_KEY] === "base";
}

export function readPricedAddOns(
  value: Record<string, unknown> | null | undefined,
): PricedAddOnSnapshot[] | null {
  const raw = value?.[PRICED_ADD_ONS_KEY];
  if (!Array.isArray(raw)) return null;
  const priced: PricedAddOnSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const amount = Number(record.amount);
    if (!id || !label || !Number.isFinite(amount) || amount <= 0) return null;
    priced.push({ id, label, amount: money(amount) });
  }
  return priced;
}

export function readAssessedAddOns(
  value: Record<string, unknown> | null | undefined,
): AssessedAddOnSnapshot[] | null {
  const raw = value?.[ASSESSED_ADD_ONS_KEY];
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const assessed: AssessedAddOnSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const note = typeof record.note === "string" ? record.note.trim() : "";
    if (!id || !label) return null;
    assessed.push({ id, label, note });
  }
  return assessed;
}

/** Freeze priced and on-site add-ons beside the customer's option names. */
export function attachBookingPriceSnapshot(
  optionNames: Record<string, string>,
  priced: PricedAddOnSnapshot[],
  assessed: AssessedAddOnSnapshot[],
) {
  return {
    ...stringAddOnOptions(optionNames),
    [SERVICE_PRICE_SCOPE_KEY]: "base" as const,
    [PRICED_ADD_ONS_KEY]: priced.map((addOn) => ({
      id: addOn.id,
      label: addOn.label,
      amount: money(addOn.amount),
    })),
    [ASSESSED_ADD_ONS_KEY]: assessed.map((addOn) => ({
      id: addOn.id,
      label: addOn.label,
      note: addOn.note,
    })),
  };
}

function preservedReservedKeys(
  current: Record<string, unknown> | null | undefined,
) {
  const kept: Record<string, unknown> = {};
  if (!current) return kept;
  for (const [key, value] of Object.entries(current)) {
    if (!isReservedAddOnKey(key) || key === VISIT_LINE_ITEMS_KEY) continue;
    if (key === PRICED_ADD_ONS_KEY || key === SERVICE_PRICE_SCOPE_KEY) continue;
    kept[key] = value;
  }
  return kept;
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
  const priced: PricedAddOnSnapshot[] = [];
  for (const item of items) {
    const catalog = item.catalogId ?? "";
    const id = catalogServiceId(catalog);
    if (!id || id === fields.serviceId) continue;
    if (!(item.amount > 0)) continue;
    priced.push({
      id,
      label: item.label.trim() || id,
      amount: money(item.amount),
    });
  }
  return {
    ...preservedReservedKeys(current),
    ...stringAddOnOptions(current),
    ...fields.addOnOptions,
    [SERVICE_PRICE_SCOPE_KEY]: "base",
    [PRICED_ADD_ONS_KEY]: priced,
    [VISIT_LINE_ITEMS_KEY]: items,
  };
}
