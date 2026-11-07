import { drivingDistanceMiles, geocodeAddress, type GeoPoint } from "@/lib/geo";
import { calculateTravelFee, formatServiceAddress, type ServiceAddress } from "@/lib/travel";
import { hasServiceAddress } from "./booking-address";

/** Missing addresses reserve the requested time without inventing a location or a travel quote. */
export async function staffBookingLocation(address: ServiceAddress | null, deps?: {
  getBaseGeoPoint: () => Promise<GeoPoint | null>;
  geocodeAddress: typeof geocodeAddress;
  drivingDistanceMiles: typeof drivingDistanceMiles;
}): Promise<
  | { base: GeoPoint | null; destination: GeoPoint | null; quote: ReturnType<typeof calculateTravelFee> }
  | { error: "misconfigured" | "outside_area" | "server"; message?: string }
> {
  if (!hasServiceAddress(address)) return { base: null, destination: null, quote: calculateTravelFee(0) };
  const services = deps ?? { getBaseGeoPoint: (await import("@/lib/appointments/schedule")).getBaseGeoPoint, geocodeAddress, drivingDistanceMiles };
  const base = await services.getBaseGeoPoint();
  if (!base) return { error: "misconfigured" };
  const destination = await services.geocodeAddress(formatServiceAddress(address));
  if (!destination) return { error: "outside_area", message: "We could not locate that address. Please check the street and ZIP code." };
  const miles = await services.drivingDistanceMiles(base, destination);
  if (miles == null) return { error: "server" };
  const quote = calculateTravelFee(miles);
  if (!quote.withinServiceArea) return { error: "outside_area", message: quote.summary };
  return { base, destination, quote };
}
