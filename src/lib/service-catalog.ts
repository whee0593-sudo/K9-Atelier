/** Stable catalog ids. Appointment rows keep their uuid primary keys. */

export const SIGNATURE_BATH_ID = "signature-bath-care";
export const SHOW_LEVEL_COAT_CARE_ID = "show-level-coat-care";
export const LEGACY_SHOW_LEVEL_COAT_CARE_ID = "long-coat-show-care";
export const LUXURY_SPA_DAY_ID = "luxury-spa-day";

export const RETIRED_SPA_SERVICE_IDS = [
  "dead-sea-mud-bath",
  "aromatherapy-oil-bath",
  "sensitive-skin-treatment",
] as const;

/**
 * One service, one canonical id. The previous long-coat slug still resolves
 * here so historical rows and old links are not treated as a second service.
 */
export const LEGACY_SERVICE_ALIASES: Record<string, string> = {
  [LEGACY_SHOW_LEVEL_COAT_CARE_ID]: SHOW_LEVEL_COAT_CARE_ID,
};

export function canonicalServiceId(serviceId: string) {
  const trimmed = serviceId.trim();
  return LEGACY_SERVICE_ALIASES[trimmed] ?? trimmed;
}

export function isRetiredSpaService(serviceId: string) {
  return (RETIRED_SPA_SERVICE_IDS as readonly string[]).includes(
    canonicalServiceId(serviceId),
  );
}

export function isLuxurySpaDay(serviceId: string) {
  return canonicalServiceId(serviceId) === LUXURY_SPA_DAY_ID;
}
