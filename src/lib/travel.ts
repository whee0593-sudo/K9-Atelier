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

/** Label only. The stored distance and the fee still use the raw miles. */
export function formatTravelMiles(miles: number) {
  if (!Number.isFinite(miles)) return "0";
  const display = Math.round(miles * 100) / 100;
  if (Number.isInteger(display)) return String(display);
  return display.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function calculateTravelFee(distanceMiles: number): TravelQuote {
  const {
    freeRadiusMiles,
    maxDistanceMiles,
    travelFeePerMile,
    standardServiceMiles,
  } = business.serviceArea;

  const miles = distanceMiles;
  const withinFreeRadius = Number.isFinite(miles) && miles <= freeRadiusMiles;
  const withinServiceArea =
    Number.isFinite(miles) && miles <= standardServiceMiles;

  let zone: TravelZone = "outside";
  let billableMiles = 0;
  let fee = 0;

  if (withinFreeRadius) {
    zone = "complimentary";
  } else if (withinServiceArea) {
    zone = miles <= maxDistanceMiles ? "standard" : "extended";
    billableMiles = Math.ceil(miles - freeRadiusMiles);
    fee = billableMiles * travelFeePerMile;
  }

  const shown = formatTravelMiles(miles);
  let summary: string;
  if (zone === "outside") {
    summary = `This address is outside our standard ${standardServiceMiles}-mile service area. Please contact us to inquire about availability.`;
  } else if (zone === "complimentary") {
    summary = `${shown} mi from base — Complimentary travel`;
  } else {
    summary = `${shown} mi from base — travel fee ${formatPrice(fee)}.`;
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
