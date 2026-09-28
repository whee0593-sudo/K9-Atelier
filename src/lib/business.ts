import businessData from "../../content/business.json";

export type Business = typeof businessData;

export const business: Business = businessData;

export function getBrandSearchName() {
  return business.brand.searchName?.trim() || "K9 Atelier Mobile Pet Spa";
}

/** Click-to-call href for the public studio number, or null if none is set. */
export function getBrandPhoneTelHref() {
  const phone = business.brand.phone;
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return digits.length >= 8 ? `tel:+${digits}` : null;
}

/** schema.org telephone, e.g. +1-561-593-3335. */
export function getBrandSchemaTelephone() {
  const href = getBrandPhoneTelHref();
  if (!href) return undefined;
  const digits = href.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : "";
  if (national.length !== 10) return href.replace(/^tel:/, "");
  return `+1-${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
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
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `$${rounded}`;
  return `$${rounded.toFixed(2)}`;
}

export function formatDuration(min: number, max?: number) {
  if (max && max !== min) return `${min}–${max} min`;
  return `${min} min`;
}

export function getCommunitiesServedLabel() {
  return (
    business.serviceArea.communitiesServed ??
    "Palm Beach · Jupiter · Palm Beach Gardens · West Palm Beach"
  );
}

export function getCommunitiesServed() {
  return getCommunitiesServedLabel()
    .split(" · ")
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Footer line, e.g. "Serving Palm Beach, Jupiter, Palm Beach Gardens & West Palm Beach." */
export function getServiceAreaFooterSentence() {
  const parts = getCommunitiesServed();
  if (parts.length === 0) return "Serving Palm Beach.";
  if (parts.length === 1) return `Serving ${parts[0]}.`;
  return `Serving ${parts.slice(0, -1).join(", ")} & ${parts.at(-1)}.`;
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
