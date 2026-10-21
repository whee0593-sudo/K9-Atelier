import { unstable_rethrow } from "next/navigation";
import { getStaffSession } from "@/lib/staff/auth";

/**
 * Catalog and in-progress booking prices follow the server staff session.
 * A client-side admin flag cannot reveal them.
 */
export function servicePricesVisibleToViewer(input: {
  serverStaff: boolean;
  clientClaimsAdmin?: boolean;
}) {
  return input.serverStaff === true;
}

export async function viewerCanViewServicePrices() {
  try {
    const session = await getStaffSession();
    return servicePricesVisibleToViewer({
      serverStaff: !("error" in session),
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "viewerCanViewServicePrices failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}

/** Dollar amounts, hourly rates, and complimentary service prices. */
export function containsDisplayedServicePrice(text: string) {
  return /\$\s?\d|\/\s?hour|\/hr\b|complimentary/i.test(text);
}
