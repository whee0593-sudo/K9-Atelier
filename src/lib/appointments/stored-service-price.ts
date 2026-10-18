import { snapshotServicePrice } from "@/lib/visits/visit";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import {
  appointmentFieldsFromVisitLineItems,
  attachBookingPriceSnapshot,
  readPricedAddOns,
  readStoredVisitLineItems,
  servicePriceIsBaseOnly,
  type AssessedAddOnSnapshot,
  type PricedAddOnSnapshot,
} from "@/lib/charges/visit-line-items";
import type { ChargeLineItem } from "@/lib/charges/types";
import type { BookingPriceQuote } from "@/lib/booking-price";

/**
 * Guest bookings store only the primary service amount.
 * Priced add-ons are frozen beside it. Assessed care has no amount.
 */
export function guestBookingStoredServicePrice(quote: { servicePrice: number }) {
  return snapshotServicePrice(quote.servicePrice);
}

export function guestBookingStoredAddOnOptions(
  quote: Pick<BookingPriceQuote, "addOns" | "assessedAddOns">,
  optionNames: Record<string, string>,
) {
  const priced: PricedAddOnSnapshot[] = quote.addOns.map((addOn) => ({
    id: addOn.id,
    label: addOn.name,
    amount: addOn.price,
  }));
  const assessed: AssessedAddOnSnapshot[] = quote.assessedAddOns.map((addOn) => ({
    id: addOn.id,
    label: addOn.name,
    note: addOn.note,
  }));
  return attachBookingPriceSnapshot(optionNames, priced, assessed);
}

type ScheduledPriceRow = {
  estimated_total?: number | null;
  service_price?: number | null;
  travel_fee?: number | null;
  add_on_ids?: string[] | null;
  add_on_options?: Record<string, unknown> | null;
};

function money(amount: number) {
  return Math.round(amount * 100) / 100;
}

/**
 * Main-service dollars for a change fee.
 * A base-price snapshot or a saved service line is reliable.
 * An appointment with no add-ons has nothing to split.
 * Anything else needs a person to confirm the amount.
 */
export function feeServicePortion(
  row: ScheduledPriceRow,
): { ok: true; amount: number } | { ok: false } {
  const options = row.add_on_options ?? null;
  const lines = readStoredVisitLineItems(options);
  if (lines) {
    const primary = primaryServicePriceFromLineItems(lines);
    if (primary != null) return { ok: true, amount: primary };
  }
  const service =
    row.service_price != null && Number.isFinite(Number(row.service_price))
      ? Number(row.service_price)
      : null;
  if (servicePriceIsBaseOnly(options) && service != null && readPricedAddOns(options)) {
    return { ok: true, amount: service };
  }
  const addOnIds = row.add_on_ids;
  if (addOnIds != null && addOnIds.length === 0 && service != null) {
    return { ok: true, amount: service };
  }
  if (addOnIds != null && addOnIds.length === 0 && service == null) {
    const estimated =
      row.estimated_total == null ? null : Number(row.estimated_total);
    if (estimated != null && Number.isFinite(estimated)) {
      const travel = Number(row.travel_fee ?? 0);
      return {
        ok: true,
        amount: travel > 0 && estimated >= travel ? money(estimated - travel) : money(estimated),
      };
    }
  }
  return { ok: false };
}

/**
 * Scheme B fee base: main service plus one applicable travel fee.
 * Priced add-ons stay in estimated_total and are not part of this base.
 * remove_dog never includes travel; the visit mirror keeps that fee on a remaining dog.
 * Other actions use the highest stored travel fee once, never the sum.
 */
export function changeFeeBase(
  action: AppointmentChangeAction,
  rows: ScheduledPriceRow[],
): { ok: true; amount: number } | { ok: false } {
  let serviceTotal = 0;
  for (const row of rows) {
    const portion = feeServicePortion(row);
    if (!portion.ok) return { ok: false };
    serviceTotal += portion.amount;
  }
  const travel =
    action === "remove_dog"
      ? 0
      : rows.reduce((max, row) => Math.max(max, Number(row.travel_fee ?? 0)), 0);
  return { ok: true, amount: money(serviceTotal + travel) };
}

/**
 * Address rewrites keep the non-travel portion of the stored total,
 * so priced add-ons stay in the new estimate. service_price is only
 * the fallback when no total was stored.
 */
export function addressServicePortion(row: ScheduledPriceRow) {
  if (row.estimated_total != null && Number.isFinite(Number(row.estimated_total))) {
    return (
      Math.round(
        (Number(row.estimated_total) - Number(row.travel_fee ?? 0)) * 100,
      ) / 100
    );
  }
  if (row.service_price != null && Number.isFinite(Number(row.service_price))) {
    return Number(row.service_price);
  }
  return null;
}

/** First catalog service line. Later lines are add-ons or custom care. */
export function primaryServicePriceFromLineItems(items: ChargeLineItem[]) {
  const fields = appointmentFieldsFromVisitLineItems(items);
  if (!fields.serviceId) return null;
  const primary = items.find((item) => {
    const catalog = item.catalogId ?? "";
    if (!catalog || catalog === "travel-fee" || catalog === "no-show") return false;
    return catalog.split("::")[0] === fields.serviceId;
  });
  if (!primary || !Number.isFinite(primary.amount)) return null;
  return snapshotServicePrice(primary.amount);
}
