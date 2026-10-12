import { business, formatPrice } from "./business";

export type ServiceAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type TravelZone =
  | "complimentary"
  | "standard"
  | "extended"
  | "outside";

export type TravelQuote = {
  distanceMiles: number;
  freeMiles: number;
  billableMiles: number;
  fee: number;
  withinServiceArea: boolean;
  withinFreeRadius: boolean;
  zone: TravelZone;
  summary: string;
  lat?: number;
  lon?: number;
};

export function formatServiceAddress(address: ServiceAddress) {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}

/** Nearest whole dollar. Miles are not rounded before this. */
function roundTravelFee(amount: number) {
  return Math.round(amount);
}

/** Label only. The stored distance and the fee still use the raw miles. */
export function formatTravelMiles(miles: number) {
  if (!Number.isFinite(miles)) return "0";
  const display = Math.round(miles * 100) / 100;
  if (Number.isInteger(display)) return String(display);
  return display.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * One-way travel fee from the service base.
 * Bands use the original GPS miles:
 * 0–10 miles: $0
 * above 10 through 20: (distance − 10) × $6.50
 * above 20 through 25: $65 + (distance − 20) × $10
 * Beyond 25: no automatic fee
 * Only the final dollar amount is rounded.
 */
function travelFeeAmount(miles: number) {
  const {
    freeRadiusMiles,
    travelFeePerMile,
    maxDistanceMiles,
    extendedTravelFeePerMile,
    standardServiceMiles,
  } = business.serviceArea;

  if (miles <= freeRadiusMiles || miles > standardServiceMiles) {
    return 0;
  }

  if (miles <= maxDistanceMiles) {
    return roundTravelFee((miles - freeRadiusMiles) * travelFeePerMile);
  }

  const throughStandardMiles =
    (maxDistanceMiles - freeRadiusMiles) * travelFeePerMile;
  const extendedMiles = miles - maxDistanceMiles;
  return roundTravelFee(
    throughStandardMiles + extendedMiles * extendedTravelFeePerMile,
  );
}

export function calculateTravelFee(distanceMiles: number): TravelQuote {
  const {
    freeRadiusMiles,
    maxDistanceMiles: standardRateThroughMiles,
    standardServiceMiles,
  } = business.serviceArea;

  const miles = distanceMiles;
  const withinFreeRadius = Number.isFinite(miles) && miles <= freeRadiusMiles;
  const withinStandardRate =
    Number.isFinite(miles) && miles <= standardRateThroughMiles;
  const withinServiceArea =
    Number.isFinite(miles) && miles <= standardServiceMiles;

  let zone: TravelZone = "outside";
  let billableMiles = 0;
  let fee = 0;

  if (withinFreeRadius) {
    zone = "complimentary";
  } else if (withinServiceArea) {
    zone = withinStandardRate ? "standard" : "extended";
    billableMiles = miles - freeRadiusMiles;
    fee = travelFeeAmount(miles);
  }

  const shown = formatTravelMiles(miles);
  let summary: string;
  if (zone === "outside") {
    summary = `This address is outside our standard ${standardServiceMiles}-mile service area. Please contact us to inquire about availability.`;
  } else if (zone === "complimentary") {
    summary = `${shown} mi from base — Complimentary travel`;
  } else if (zone === "standard") {
    summary = `${shown} mi from base — travel fee ${formatPrice(fee)}.`;
  } else {
    summary = `Extended Service Area. An extended travel fee applies to this location. Travel fee ${formatPrice(fee)}.`;
  }

  return {
    distanceMiles: miles,
    freeMiles: freeRadiusMiles,
    billableMiles,
    fee,
    withinServiceArea,
    withinFreeRadius,
    zone,
    summary,
  };
}
