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
 * Progressive one-way travel fee.
 * 0–free: $0
 * above free through the $6.50 tier: (miles − free) × $6.50
 * above that tier through the standard service limit:
 *   (tier miles × $6.50) + (miles above the tier × extended rate)
 * Beyond the standard service limit: no automatic fee.
 */
export function calculateTravelFee(distanceMiles: number): TravelQuote {
  const {
    freeRadiusMiles,
    travelFeePerMile,
    maxDistanceMiles: standardRateThroughMiles,
    extendedTravelFeePerMile,
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
  } else if (withinStandardRate) {
    zone = "standard";
    billableMiles = roundToTenth(rounded - freeRadiusMiles);
    fee = roundTravelFee(billableMiles * travelFeePerMile);
  } else if (withinServiceArea) {
    zone = "extended";
    const standardMiles = roundToTenth(standardRateThroughMiles - freeRadiusMiles);
    const extendedMiles = roundToTenth(rounded - standardRateThroughMiles);
    billableMiles = roundToTenth(standardMiles + extendedMiles);
    fee = roundTravelFee(
      standardMiles * travelFeePerMile +
        extendedMiles * extendedTravelFeePerMile,
    );
  }

  let summary: string;
  if (zone === "outside") {
    summary = `This address is outside our standard ${standardServiceMiles}-mile service area. Please contact us to inquire about availability.`;
  } else if (zone === "complimentary") {
    summary = `${rounded} mi from base — Complimentary travel`;
  } else if (zone === "standard") {
    summary = `${rounded} mi from base — ${billableMiles} mi beyond free radius × ${formatPrice(travelFeePerMile)} = ${formatPrice(fee)} travel fee.`;
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
