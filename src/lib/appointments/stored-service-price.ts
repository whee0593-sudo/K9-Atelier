import { snapshotServicePrice } from "@/lib/visits/visit";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import { appointmentFieldsFromVisitLineItems } from "@/lib/charges/visit-line-items";
import type { ChargeLineItem } from "@/lib/charges/types";

/**
 * Guest bookings store only the primary service amount.
 * Add-ons and travel stay on their own fields and bill lines.
 */
export function guestBookingStoredServicePrice(quote: { servicePrice: number }) {
  return snapshotServicePrice(quote.servicePrice);
}

type ScheduledPriceRow = {
  estimated_total?: number | null;
  service_price?: number | null;
  travel_fee?: number | null;
};

/**
 * Cancel and reschedule fees use the stored appointment total.
 * That total already includes priced add-ons and this row's travel fee.
 * When it is missing, fall back to the stored service price plus travel.
 */
export function scheduledAppointmentTotal(row: ScheduledPriceRow) {
  if (row.estimated_total != null && Number.isFinite(Number(row.estimated_total))) {
    return Number(row.estimated_total);
  }
  const service =
    row.service_price != null && Number.isFinite(Number(row.service_price))
      ? Number(row.service_price)
      : 0;
  return (
    Math.round((service + Number(row.travel_fee ?? 0)) * 100) / 100
  );
}

export function changeQuoteEstimatedTotal(
  action: AppointmentChangeAction,
  rows: ScheduledPriceRow[],
) {
  const total = rows.reduce((sum, row) => {
    const scheduled = scheduledAppointmentTotal(row);
    if (action !== "remove_dog") return sum + scheduled;
    const travel = Number(row.travel_fee ?? 0);
    return sum + Math.max(0, Math.round((scheduled - travel) * 100) / 100);
  }, 0);
  return Math.round(total * 100) / 100;
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
