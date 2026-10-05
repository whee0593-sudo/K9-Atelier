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

/** First chargeable band ends here: miles above 10 through 15 at $10. */
const FIRST_CHARGE_END_MILES = 15;
const FIRST_CHARGE_PER_MILE = 10;
/** Miles above 15 through 20 at $15. Matches the existing standard-zone display. */
const SECOND_CHARGE_PER_MILE = 15;
/** Miles above 20 through the standard service limit at $20. */
const EXTENDED_CHARGE_PER_MILE = 20;

/**
 * Progressive one-way travel fee. Each mile is charged at the rate for its
 * own band. The highest rate is never applied to the whole distance.
 * 0–10: $0
 * above 10 through 15: (distance − 10) × $10
 * above 15 through 20: $50 + (distance − 15) × $15
 * above 20 through the service limit: $125 + (distance − 20) × $20
 * Beyond the service limit: no automatic fee.
 */
function progressiveTravelFee(roundedMiles: number, freeRadiusMiles: number) {
  const firstBandMiles = roundToTenth(
    Math.max(0, Math.min(roundedMiles, FIRST_CHARGE_END_MILES) - freeRadiusMiles),
  );
  const secondBandMiles = roundToTenth(
    Math.max(0, Math.min(roundedMiles, business.serviceArea.maxDistanceMiles) - FIRST_CHARGE_END_MILES),
  );
  const extendedBandMiles = roundToTenth(
    Math.max(0, roundedMiles - business.serviceArea.maxDistanceMiles),
  );
  return roundTravelFee(
    firstBandMiles * FIRST_CHARGE_PER_MILE +
      secondBandMiles * SECOND_CHARGE_PER_MILE +
      extendedBandMiles * EXTENDED_CHARGE_PER_MILE,
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
    fee = progressiveTravelFee(rounded, freeRadiusMiles);
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
