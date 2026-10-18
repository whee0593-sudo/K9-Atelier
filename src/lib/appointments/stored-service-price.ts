import { snapshotServicePrice } from "@/lib/visits/visit";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import {
  appointmentFieldsFromVisitLineItems,
  attachBookingPriceSnapshot,
  readAssessedAddOns,
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

function positiveAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Confirmed non-travel dollars for a change fee.
 * Saved visit lines include the service, priced add-ons, and other confirmed charges.
 * A base-price snapshot adds its priced add-ons to the saved service amount.
 * Unquoted assessed care and $0 lines are not charges.
 * An appointment with no add-ons uses the stored service price.
 * Anything else needs a person to confirm the amount.
 */
export function feeServicePortion(
  row: ScheduledPriceRow,
): { ok: true; amount: number } | { ok: false } {
  const options = row.add_on_options ?? null;
  const lines = readStoredVisitLineItems(options);
  if (lines) {
    let sum = 0;
    let counted = false;
    for (const item of lines) {
      const catalog = item.catalogId ?? "";
      if (catalog === "travel-fee" || catalog === "no-show") continue;
      if (!(item.amount > 0)) continue;
      sum += item.amount;
      counted = true;
    }
    if (counted) return { ok: true, amount: money(sum) };
  }
  const service =
    row.service_price != null && Number.isFinite(Number(row.service_price))
      ? Number(row.service_price)
      : null;
  const priced = readPricedAddOns(options);
  if (servicePriceIsBaseOnly(options) && service != null && priced) {
    if (readAssessedAddOns(options) == null) return { ok: false };
    const addOnTotal = priced.reduce((sum, item) => sum + item.amount, 0);
    return { ok: true, amount: money(service + addOnTotal) };
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

function storedTravelFee(row: ScheduledPriceRow) {
  const column = positiveAmount(Number(row.travel_fee ?? 0));
  const lines = readStoredVisitLineItems(row.add_on_options ?? null);
  const line = lines?.find((item) => item.catalogId === "travel-fee");
  return Math.max(column, positiveAmount(line?.amount ?? 0));
}

/**
 * Confirmed order amount for a change fee.
 * Cancel and reschedule include every target dog's confirmed charges
 * plus one travel fee for the visit.
 * remove_dog includes only that dog's confirmed charges.
 * The travel fee stays with the visit and is not charged again.
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
      : rows.reduce((max, row) => Math.max(max, storedTravelFee(row)), 0);
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
