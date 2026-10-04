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

export type StaffServiceAddressRecord = StaffServiceAddress & {
  id: string | null;
  source: "saved" | "visit";
};

function addressesMatch(left: StaffServiceAddress, right: StaffServiceAddress) {
  return (
    left.street === right.street &&
    left.city === right.city &&
    left.state === right.state &&
    left.zip === right.zip
  );
}

function addressKey(address: StaffServiceAddress) {
  return [address.street, address.city, address.state, address.zip]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

type QuoteResult =
  | {
      ok: true;
      lat: number;
      lon: number;
      travelDistanceMiles: number | null;
      travelFee: number;
    }
  | {
      ok: false;
      error: "outside_area" | "server";
      message?: string;
    };

async function quoteServiceAddress(
  address: StaffServiceAddress,
): Promise<QuoteResult> {
  const destination = await geocodeAddress(formatServiceAddress(address));
  if (!destination) {
    return {
      ok: false,
      error: "outside_area",
      message:
        "We could not locate that address. Please check the street and ZIP code.",
    };
  }

  const base = await getBaseGeoPoint();
  if (!base) {
    return {
      ok: true,
      lat: destination.lat,
      lon: destination.lon,
      travelDistanceMiles: null,
      travelFee: 0,
    };
  }

  const miles = await drivingDistanceMiles(base, destination);
  if (miles == null) return { ok: false, error: "server" };
  const quote = calculateTravelFee(miles);
  if (!quote.withinServiceArea) {
    return { ok: false, error: "outside_area", message: quote.summary };
  }
  return {
    ok: true,
    lat: destination.lat,
    lon: destination.lon,
    travelDistanceMiles: quote.distanceMiles,
    travelFee: quote.fee,
  };
}

async function ensureCustomerExists(customerId: string): Promise<
  | { ok: true; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; error: "not_found" | "server" }
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();
  if (error) {
    console.error("ensureCustomerExists failed:", error.message);
    return { ok: false, error: "server" };
  }
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, admin };
}

export async function listStaffCustomerServiceAddresses(
  customerId: string,
): Promise<
  | { addresses: StaffServiceAddressRecord[] }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const ensured = await ensureCustomerExists(customerId);
  if (!ensured.ok) return { error: ensured.error };
  const { admin } = ensured;

  const [savedResult, visitResult] = await Promise.all([
    admin
      .from("customer_service_addresses")
      .select("id, street, city, state, zip, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true }),
    admin
      .from("appointments")
      .select("address_street, address_city, address_state, address_zip, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true }),
  ]);

  if (savedResult.error) {
    console.error(
      "listStaffCustomerServiceAddresses saved failed:",
      savedResult.error.message,
    );
    return { error: "server" };
  }
  if (visitResult.error) {
    console.error(
      "listStaffCustomerServiceAddresses visits failed:",
      visitResult.error.message,
    );
    return { error: "server" };
  }

  const byKey = new Map<string, StaffServiceAddressRecord>();

  for (const row of savedResult.data ?? []) {
    const address: StaffServiceAddressRecord = {
      id: row.id as string,
      street: row.street as string,
      city: row.city as string,
      state: row.state as string,
      zip: row.zip as string,
      source: "saved",
    };
    byKey.set(addressKey(address), address);
  }

  for (const row of visitResult.data ?? []) {
    const address: StaffServiceAddress = {
      street: (row.address_street as string) ?? "",
      city: (row.address_city as string) ?? "",
      state: (row.address_state as string) ?? "",
      zip: (row.address_zip as string) ?? "",
    };
    if (!address.street && !address.city && !address.zip) continue;
    const key = addressKey(address);
    if (byKey.has(key)) continue;
    byKey.set(key, { ...address, id: null, source: "visit" });
  }

  return { addresses: [...byKey.values()] };
}

export type StaffAddressWriteResult = {
  address: StaffServiceAddressRecord;
  updatedVisitCount: number;
};

export async function addStaffCustomerServiceAddress(
  customerId: string,
  address: StaffServiceAddress,
): Promise<
  | StaffAddressWriteResult
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "outside_area"
        | "conflict"
        | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const ensured = await ensureCustomerExists(customerId);
  if (!ensured.ok) return { error: ensured.error };
  const { admin } = ensured;

  const quote = await quoteServiceAddress(address);
  if (!quote.ok) return quote;

  const { data: existing, error: existingError } = await admin
    .from("customer_service_addresses")
    .select("id, street, city, state, zip")
    .eq("customer_id", customerId)
    .ilike("street", address.street)
    .ilike("city", address.city)
    .ilike("state", address.state)
    .ilike("zip", address.zip)
    .maybeSingle();
  if (existingError) {
    console.error(
      "addStaffCustomerServiceAddress lookup failed:",
      existingError.message,
    );
    return { error: "server" };
  }
  if (existing) {
    return {
      error: "conflict",
      message: "That service address is already on this customer file.",
    };
  }

  const { count: existingCount, error: countError } = await admin
    .from("customer_service_addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if (countError) {
    console.error(
      "addStaffCustomerServiceAddress count failed:",
      countError.message,
    );
    return { error: "server" };
  }

  const { data, error } = await admin
    .from("customer_service_addresses")
    .insert({
      customer_id: customerId,
      street: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
      address_lat: quote.lat,
      address_lon: quote.lon,
      is_default: (existingCount ?? 0) === 0,
    })
    .select("id, street, city, state, zip")
    .single();

  if (error) {
    console.error("addStaffCustomerServiceAddress insert failed:", error.message);
    if (/duplicate|unique/i.test(error.message)) {
      return {
        error: "conflict",
        message: "That service address is already on this customer file.",
      };
    }
    return { error: "server" };
  }

  return {
    address: {
      id: data.id as string,
      street: data.street as string,
      city: data.city as string,
      state: data.state as string,
      zip: data.zip as string,
      source: "saved",
    },
    updatedVisitCount: 0,
  };
}

export async function rewriteStaffCustomerServiceAddress(
  customerId: string,
  from: StaffServiceAddress,
  to: StaffServiceAddress,
): Promise<
  | StaffAddressWriteResult
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "outside_area"
        | "conflict"
        | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  if (addressesMatch(from, to)) {
    const listed = await listStaffCustomerServiceAddresses(customerId);
    if ("error" in listed) return listed;
    const existing =
      listed.addresses.find((address) => addressesMatch(address, to)) ?? {
        ...to,
        id: null,
        source: "visit" as const,
      };
    return { address: existing, updatedVisitCount: 0 };
  }

  const ensured = await ensureCustomerExists(customerId);
  if (!ensured.ok) return { error: ensured.error };
  const { admin } = ensured;

  const quote = await quoteServiceAddress(to);
  if (!quote.ok) return quote;

  const { data: duplicate, error: duplicateError } = await admin
    .from("customer_service_addresses")
    .select("id")
    .eq("customer_id", customerId)
    .ilike("street", to.street)
    .ilike("city", to.city)
    .ilike("state", to.state)
    .ilike("zip", to.zip)
    .maybeSingle();
  if (duplicateError) {
    console.error(
      "rewriteStaffCustomerServiceAddress duplicate check failed:",
      duplicateError.message,
    );
    return { error: "server" };
  }

  const { data: savedFrom, error: savedFromError } = await admin
    .from("customer_service_addresses")
    .select("id, is_default")
    .eq("customer_id", customerId)
    .eq("street", from.street)
    .eq("city", from.city)
    .eq("state", from.state)
    .eq("zip", from.zip)
    .maybeSingle();
  if (savedFromError) {
    console.error(
      "rewriteStaffCustomerServiceAddress saved lookup failed:",
      savedFromError.message,
    );
    return { error: "server" };
  }

  if (duplicate && (!savedFrom || duplicate.id !== savedFrom.id)) {
    return {
      error: "conflict",
      message: "Another saved address already uses those details.",
    };
  }

  const { data: visitRows, error: loadError } = await admin
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

  const matches = visitRows ?? [];
  if (!savedFrom && matches.length === 0) {
    return { error: "not_found", message: "No addresses match that entry." };
  }

  for (const row of matches) {
    const previousFee = Number(row.travel_fee ?? 0);
    const previousTotal =
      row.estimated_total == null ? null : Number(row.estimated_total);
    const nextTotal =
      previousTotal == null
        ? null
        : Math.round((previousTotal - previousFee + quote.travelFee) * 100) / 100;

    const { error: updateError } = await admin
      .from("appointments")
      .update({
        address_street: to.street,
        address_city: to.city,
        address_state: to.state,
        address_zip: to.zip,
        address_lat: quote.lat,
        address_lon: quote.lon,
        ...(quote.travelDistanceMiles != null
          ? {
              travel_distance_miles: quote.travelDistanceMiles,
              travel_fee: quote.travelFee,
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

  let savedId: string | null = savedFrom?.id ?? null;
  if (savedFrom) {
    const { data: updatedSaved, error: updateSavedError } = await admin
      .from("customer_service_addresses")
      .update({
        street: to.street,
        city: to.city,
        state: to.state,
        zip: to.zip,
        address_lat: quote.lat,
        address_lon: quote.lon,
      })
      .eq("id", savedFrom.id as string)
      .eq("customer_id", customerId)
      .select("id")
      .single();
    if (updateSavedError) {
      console.error(
        "rewriteStaffCustomerServiceAddress saved update failed:",
        updateSavedError.message,
      );
      return { error: "server" };
    }
    savedId = updatedSaved.id as string;
  } else {
    const { count: existingCount, error: countError } = await admin
      .from("customer_service_addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId);
    if (countError) {
      console.error(
        "rewriteStaffCustomerServiceAddress count failed:",
        countError.message,
      );
      return { error: "server" };
    }
    const { data: inserted, error: insertError } = await admin
      .from("customer_service_addresses")
      .insert({
        customer_id: customerId,
        street: to.street,
        city: to.city,
        state: to.state,
        zip: to.zip,
        address_lat: quote.lat,
        address_lon: quote.lon,
        is_default: (existingCount ?? 0) === 0,
      })
      .select("id")
      .single();
    if (insertError) {
      console.error(
        "rewriteStaffCustomerServiceAddress saved insert failed:",
        insertError.message,
      );
      return { error: "server" };
    }
    savedId = inserted.id as string;
  }

  return {
    address: {
      id: savedId,
      street: to.street,
      city: to.city,
      state: to.state,
      zip: to.zip,
      source: "saved",
    },
    updatedVisitCount: matches.length,
  };
}
