import { business, formatPrice } from "./business";

export type ServiceAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type TravelQuote = {
  distanceMiles: number;
  freeMiles: number;
  billableMiles: number;
  fee: number;
  withinServiceArea: boolean;
  withinFreeRadius: boolean;
  summary: string;
  lat?: number;
  lon?: number;
};

export function formatServiceAddress(address: ServiceAddress) {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}

export function getBaseAddressFormatted() {
  const home = business.serviceArea.homeAddress;
  if (!home || typeof home !== "object") return null;
  return "formatted" in home ? String(home.formatted) : null;
}

/** Pure fee math from one-way miles */
export function calculateTravelFee(distanceMiles: number): TravelQuote {
  const { freeRadiusMiles, travelFeePerMile, maxDistanceMiles } =
    business.serviceArea;

  const rounded = Math.round(distanceMiles * 10) / 10;
  const withinServiceArea = rounded <= maxDistanceMiles;
  const withinFreeRadius = rounded <= freeRadiusMiles;
  const billableMiles = withinServiceArea
    ? Math.max(0, Math.round((rounded - freeRadiusMiles) * 10) / 10)
    : 0;
  const fee =
    Math.round(billableMiles * travelFeePerMile * 100) / 100;

  let summary: string;
  if (!withinServiceArea) {
    summary = `Outside our ${maxDistanceMiles}-mile service area (${rounded} mi).`;
  } else if (withinFreeRadius) {
    summary = `${rounded} mi from base — within free ${freeRadiusMiles}-mile radius. Travel fee: $0.`;
  } else {
    summary = `${rounded} mi from base — ${billableMiles} mi beyond free radius × ${formatPrice(travelFeePerMile)} = ${formatPrice(fee)} travel fee.`;
  }

  return {
    distanceMiles: rounded,
    freeMiles: freeRadiusMiles,
    billableMiles,
    fee,
    withinServiceArea,
    withinFreeRadius,
    summary,
  };
}
