import businessData from "../../content/business.json";

export type Business = typeof businessData;

export const business: Business = businessData;

/** Click-to-call href for the public studio number, or null if none is set. */
export function getBrandPhoneTelHref() {
  const phone = business.brand.phone;
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return digits.length >= 8 ? `tel:+${digits}` : null;
}

export function getBrandWebsiteUrl() {
  return business.brand.website?.trim() || "https://k9atelier.com";
}

export function getBrandWebsiteLabel() {
  try {
    const host = new URL(getBrandWebsiteUrl()).hostname.replace(/^www\./i, "");
    if (host.toLowerCase() === "k9atelier.com") return "K9Atelier.com";
    return host;
  } catch {
    return "K9Atelier.com";
  }
}

export function getBrandInstagramUrl() {
  const fromBrand = business.brand.social.instagramUrl?.trim();
  if (fromBrand) return fromBrand;
  const fromSite = business.site.underConstruction?.instagramUrl?.trim();
  return fromSite || null;
}

export function getGoogleProfileUrl() {
  const google = business.brand.google;
  return google.businessProfileUrl || google.mapsSearchUrl || null;
}

export function getGoogleWriteReviewUrl() {
  const fromEnv =
    process.env.GOOGLE_REVIEW_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim();
  if (fromEnv) return fromEnv;
  return business.brand.google.writeReviewUrl?.trim() || null;
}

export function getBookAgainPath() {
  return "/book";
}

export function getBookAgainUrl() {
  return `${getBrandWebsiteUrl().replace(/\/$/, "")}${getBookAgainPath()}`;
}

export function getBrandPublicLinks() {
  return {
    websiteUrl: getBrandWebsiteUrl(),
    websiteLabel: getBrandWebsiteLabel(),
    instagramUrl: getBrandInstagramUrl(),
    googleReviewUrl: getGoogleWriteReviewUrl(),
    bookAgainUrl: getBookAgainUrl(),
  };
}

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
    "A valid payment method is required before you can reserve an appointment.",
    "After you choose your appointment date and time, you will add or select which saved card to use for that visit.",
    "You are not charged when you book. Payment is settled after your appointment. Late cancellations and no-shows may be charged to the selected card according to our cancellation policy.",
  ] as const;
}
