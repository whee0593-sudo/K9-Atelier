import "server-only";

/**
 * Internal origin for one-way driving distance.
 * Server-side only — do not render this address in customer UI.
 */
const SERVICE_AREA_BASE_ADDRESS = "1408 N Killian Dr, Lake Park, FL 33403";

/** Private base address used for server-side routing and travel quotes only. */
export function getBaseAddressFormatted() {
  return SERVICE_AREA_BASE_ADDRESS;
}
