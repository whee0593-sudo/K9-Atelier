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

function roundToTenth(miles: number) {
  return Math.round(miles * 10) / 10;
}

/** Nearest whole dollar for the customer-facing travel fee. */
function roundTravelFee(amount: number) {
  return Math.round(amount);
}

/**
 * One-way travel fee from the service base.
 * 0–10 miles: $0
 * above 10 through 20: (distance − 10) × $6.50
 * above 20 through 25: $65 + (distance − 20) × $10
 * Beyond 25: no automatic fee
 * The dollar amount is rounded to the nearest whole dollar.
 */
function travelFeeAmount(roundedMiles: number) {
  const {
    freeRadiusMiles,
    travelFeePerMile,
    maxDistanceMiles,
    extendedTravelFeePerMile,
    standardServiceMiles,
  } = business.serviceArea;

  if (roundedMiles <= freeRadiusMiles || roundedMiles > standardServiceMiles) {
    return 0;
  }

  if (roundedMiles <= maxDistanceMiles) {
    const billableMiles = roundToTenth(roundedMiles - freeRadiusMiles);
    return roundTravelFee(billableMiles * travelFeePerMile);
  }

  const throughStandardMiles =
    (maxDistanceMiles - freeRadiusMiles) * travelFeePerMile;
  const extendedMiles = roundToTenth(roundedMiles - maxDistanceMiles);
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

  const rounded = roundToTenth(distanceMiles);
  const withinFreeRadius = rounded <= freeRadiusMiles;
  const withinStandardRate = rounded <= standardRateThroughMiles;
  const withinServiceArea = rounded <= standardServiceMiles;

  let zone: TravelZone = "outside";
  let billableMiles = 0;
  let fee = 0;

  if (withinFreeRadius) {
    zone = "complimentary";
  } else if (withinServiceArea) {
    zone = withinStandardRate ? "standard" : "extended";
    billableMiles = roundToTenth(rounded - freeRadiusMiles);
    fee = travelFeeAmount(rounded);
  }

  let summary: string;
  if (zone === "outside") {
    summary = `This address is outside our standard ${standardServiceMiles}-mile service area. Please contact us to inquire about availability.`;
  } else if (zone === "complimentary") {
    summary = `${rounded} mi from base — Complimentary travel`;
  } else if (zone === "standard") {
    summary = `${rounded} mi from base — travel fee ${formatPrice(fee)}.`;
  } else {
    summary = `Extended Service Area. An extended travel fee applies to this location. Travel fee ${formatPrice(fee)}.`;
  }

  return {
    distanceMiles: rounded,
    freeMiles: freeRadiusMiles,
    billableMiles,
    fee,
    withinServiceArea,
    withinFreeRadius,
    zone,
    summary,
  };
}
