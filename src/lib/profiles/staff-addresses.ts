import { getBaseGeoPoint } from "@/lib/appointments/schedule";
import { drivingDistanceMiles, geocodeAddress } from "@/lib/geo";
import { getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateTravelFee,
  formatServiceAddress,
  type ServiceAddress,
} from "@/lib/travel";

export type StaffServiceAddress = ServiceAddress;

function addressesMatch(left: StaffServiceAddress, right: StaffServiceAddress) {
  return (
    left.street === right.street &&
    left.city === right.city &&
    left.state === right.state &&
    left.zip === right.zip
  );
}

export type StaffAddressRewriteResult = {
  updatedCount: number;
  address: StaffServiceAddress;
};

export async function rewriteStaffCustomerServiceAddress(
  customerId: string,
  from: StaffServiceAddress,
  to: StaffServiceAddress,
): Promise<
  | StaffAddressRewriteResult
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "outside_area"
        | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  if (addressesMatch(from, to)) {
    return { updatedCount: 0, address: to };
  }

  const destination = await geocodeAddress(formatServiceAddress(to));
  if (!destination) {
    return {
      error: "outside_area",
      message:
        "We could not locate that address. Please check the street and ZIP code.",
    };
  }

  const base = await getBaseGeoPoint();
  let travelDistanceMiles: number | null = null;
  let travelFee = 0;
  if (base) {
    const miles = await drivingDistanceMiles(base, destination);
    if (miles == null) return { error: "server" };
    const quote = calculateTravelFee(miles);
    if (!quote.withinServiceArea) {
      return { error: "outside_area", message: quote.summary };
    }
    travelDistanceMiles = quote.distanceMiles;
    travelFee = quote.fee;
  }

  const admin = createAdminClient();
  const { data: rows, error: loadError } = await admin
    .from("appointments")
    .select("id, travel_fee, estimated_total")
    .eq("customer_id", customerId)
    .eq("address_street", from.street)
    .eq("address_city", from.city)
    .eq("address_state", from.state)
    .eq("address_zip", from.zip);

  if (loadError) {
    console.error(
      "rewriteStaffCustomerServiceAddress load failed:",
      loadError.message,
    );
    return { error: "server" };
  }

  const matches = rows ?? [];
  if (matches.length === 0) {
    return { error: "not_found", message: "No visits use that address." };
  }

  for (const row of matches) {
    const previousFee = Number(row.travel_fee ?? 0);
    const previousTotal =
      row.estimated_total == null ? null : Number(row.estimated_total);
    const nextTotal =
      previousTotal == null
        ? null
        : Math.round((previousTotal - previousFee + travelFee) * 100) / 100;

    const { error: updateError } = await admin
      .from("appointments")
      .update({
        address_street: to.street,
        address_city: to.city,
        address_state: to.state,
        address_zip: to.zip,
        address_lat: destination.lat,
        address_lon: destination.lon,
        ...(travelDistanceMiles != null
          ? {
              travel_distance_miles: travelDistanceMiles,
              travel_fee: travelFee,
              estimated_total: nextTotal,
            }
          : {}),
      })
      .eq("id", row.id as string)
      .eq("customer_id", customerId);

    if (updateError) {
      console.error(
        "rewriteStaffCustomerServiceAddress update failed:",
        updateError.message,
      );
      return { error: "server" };
    }
  }

  return { updatedCount: matches.length, address: to };
}
