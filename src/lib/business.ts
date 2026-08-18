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
  return [
    "A valid payment method must be on file before a pet profile can be saved.",
    "After you choose your appointment date and time, you will select which saved card to use for that visit.",
    "You are not charged when you book. Payment is settled after your appointment. Late cancellations and no-shows may be charged to the selected card according to our cancellation policy.",
  ] as const;
}
