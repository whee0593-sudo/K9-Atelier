import businessData from "../../content/business.json";

export type Business = typeof businessData;

export const business: Business = businessData;

export function formatPrice(amount: number) {
  return `$${amount}`;
}

export function formatDuration(min: number, max?: number) {
  if (max && max !== min) return `${min}–${max} min`;
  return `${min} min`;
}

export function getCommunitiesServedLabel() {
  return (
    business.serviceArea.communitiesServed ??
    "West Palm Beach · Palm Beach Gardens · Jupiter"
  );
}

function getCommunitiesServedProse() {
  const parts = getCommunitiesServedLabel().split(" · ");
  if (parts.length === 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

export function getServiceAreaFaqParagraphs() {
  const { freeRadiusMiles, maxDistanceMiles, travelFeePerMile } =
    business.serviceArea;

  return [
    `K9 Atelier serves ${getCommunitiesServedProse()}.`,
    `Travel is complimentary within ${freeRadiusMiles} miles of our base location. Between ${freeRadiusMiles}–${maxDistanceMiles} miles, a travel fee of $${travelFeePerMile} per one-way mile applies, calculated by GPS driving distance. Appointments beyond ${maxDistanceMiles} miles may be considered on a case-by-case basis — please reach out and we're happy to discuss.`,
  ] as const;
}

export function getPaymentFaqParagraphs() {
  const { newClientDeposit } = business.booking;
  return [
    "A valid payment method is required to secure every booking.",
    "Returning clients are not charged at the time of booking — payment is settled after your appointment.",
    `New clients are asked to place a $${newClientDeposit} deposit at booking to confirm their first appointment. This deposit is applied directly toward the total cost of your service, and the remaining balance is settled afterward.`,
  ] as const;
}
