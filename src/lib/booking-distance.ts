import type { GeoPoint } from "@/lib/geo";
import { drivingDistanceMiles, geocodeAddress, geocodeBaseAddress } from "@/lib/geo";
import { calculateTravelFee, type ServiceAddress, type TravelQuote } from "@/lib/travel";

export const ADDRESS_UNVERIFIED_MESSAGE =
  "We could not verify that address. Please check it and try again.";

export const OUTSIDE_SERVICE_AREA_MESSAGE =
  "Address is outside the service area.";

export type GuestDrivingQuote =
  | {
      ok: true;
      distanceMiles: number;
      point: GeoPoint;
      travel: TravelQuote;
    }
  | {
      ok: false;
      code: "address_unverified" | "outside_area";
      message: string;
    };

type DrivingDeps = {
  baseAddress?: string;
  geocode?: (query: string) => Promise<GeoPoint | null>;
  distance?: (from: GeoPoint, to: GeoPoint) => Promise<number | null>;
};

function customerQuery(address: ServiceAddress) {
  const state = address.state.trim().toUpperCase();
  return `${address.street.trim()}, ${address.city.trim()}, ${state} ${address.zip.trim()}`;
}

/**
 * Driving distance from the studio base to the submitted address.
 * Caller miles and caller fees are not inputs. A failed lookup does not
 * fall back to those values. Miles stay unrounded for the fee. The visits
 * column is numeric(5,1), so the stored mile can round to a tenth. The fee
 * stored with the visit is still the dollar calculated from the raw miles.
 */
export async function resolveGuestDrivingQuote(
  address: ServiceAddress,
  deps: DrivingDeps = {},
): Promise<GuestDrivingQuote> {
  try {
    const baseAddress =
      deps.baseAddress ??
      (await import("@/lib/server/base-address")).getBaseAddressFormatted();
    if (!baseAddress?.trim()) {
      console.error("resolveGuestDrivingQuote base address is missing");
      return {
        ok: false,
        code: "address_unverified",
        message: ADDRESS_UNVERIFIED_MESSAGE,
      };
    }

    const geocode = deps.geocode ?? geocodeAddress;
    const [from, to] = await Promise.all([
      deps.geocode
        ? deps.geocode(baseAddress)
        : geocodeBaseAddress(baseAddress),
      geocode(customerQuery(address)),
    ]);
    if (!from || !to) {
      console.error("resolveGuestDrivingQuote could not geocode the address");
      return {
        ok: false,
        code: "address_unverified",
        message: ADDRESS_UNVERIFIED_MESSAGE,
      };
    }

    const miles = await (deps.distance ?? drivingDistanceMiles)(from, to);
    if (miles == null || !Number.isFinite(miles) || miles < 0) {
      console.error("resolveGuestDrivingQuote could not measure driving distance");
      return {
        ok: false,
        code: "address_unverified",
        message: ADDRESS_UNVERIFIED_MESSAGE,
      };
    }

    const travel = calculateTravelFee(miles);
    if (!travel.withinServiceArea) {
      return {
        ok: false,
        code: "outside_area",
        message: OUTSIDE_SERVICE_AREA_MESSAGE,
      };
    }

    return { ok: true, distanceMiles: miles, point: to, travel };
  } catch (error) {
    console.error("resolveGuestDrivingQuote failed:", error);
    return {
      ok: false,
      code: "address_unverified",
      message: ADDRESS_UNVERIFIED_MESSAGE,
    };
  }
}
