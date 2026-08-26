import "server-only";

/** Private base address used for server-side routing and travel quotes only. */
export function getBaseAddressFormatted() {
  return process.env.SITE_BASE_ADDRESS?.trim() || null;
}
