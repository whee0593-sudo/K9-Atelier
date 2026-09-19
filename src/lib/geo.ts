export type GeoPoint = { lat: number; lon: number };

const METERS_PER_MILE = 1609.344;

type NextFetchInit = RequestInit & {
  next?: { revalidate?: number };
  cache?: RequestCache;
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

type GoogleRoutesResponse = {
  routes?: Array<{ distanceMeters?: number }>;
  error?: { message?: string; status?: string };
};

type GoogleLookup<T> =
  | { ok: true; value: T }
  | { ok: false; retryable: boolean; status?: string };

let cachedBasePoint: GeoPoint | null | undefined;

function googleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
}

export function isGoogleMapsConfigured() {
  return Boolean(googleMapsApiKey());
}

export function resetGeoCache() {
  cachedBasePoint = undefined;
}

function metersToMiles(meters: number) {
  return meters / METERS_PER_MILE;
}

function isRetryableGoogleStatus(status?: string) {
  return (
    status === "REQUEST_DENIED" ||
    status === "OVER_QUERY_LIMIT" ||
    status === "UNKNOWN_ERROR"
  );
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function geocodeWithGoogle(query: string): Promise<GoogleLookup<GeoPoint>> {
  const key = googleMapsApiKey();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("region", "us");
  url.searchParams.set("components", "country:US");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  } as NextFetchInit);

  const data = await readJson<GoogleGeocodeResponse>(res);
  if (!res.ok || !data) {
    console.error(
      `Google Geocoding failed (${res.status}) ${data?.error_message || data?.status || ""}`.trim(),
    );
    return { ok: false, retryable: true, status: data?.status || String(res.status) };
  }

  if (data.status !== "OK") {
    console.error(
      `Google Geocoding failed (${data.status || "unknown"})${
        data.error_message ? `: ${data.error_message}` : ""
      }`,
    );
    return {
      ok: false,
      retryable: isRetryableGoogleStatus(data.status),
      status: data.status,
    };
  }

  const location = data.results?.[0]?.geometry?.location;
  const lat = Number(location?.lat);
  const lon = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, retryable: false, status: "INVALID_RESULT" };
  }
  return { ok: true, value: { lat, lon } };
}

async function geocodeWithNominatim(query: string): Promise<GeoPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "K9AtelierBooking/1.0 (penny@k9atelier.com)",
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  } as NextFetchInit);

  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  if (googleMapsApiKey()) {
    const google = await geocodeWithGoogle(query);
    if (google.ok) return google.value;
    if (!google.retryable) return null;
    console.warn(
      `Google Geocoding unavailable (${google.status || "unknown"}); falling back to OpenStreetMap`,
    );
  }
  return geocodeWithNominatim(query);
}

async function drivingDistanceWithGoogle(
  from: GeoPoint,
  to: GeoPoint,
): Promise<number | null> {
  const key = googleMapsApiKey();
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: {
        location: { latLng: { latitude: from.lat, longitude: from.lon } },
      },
      destination: {
        location: { latLng: { latitude: to.lat, longitude: to.lon } },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "IMPERIAL",
    }),
    cache: "no-store",
  } as NextFetchInit);

  const data = await readJson<GoogleRoutesResponse>(res);
  if (!res.ok || !data) {
    console.error(
      `Google Routes failed (${res.status}) ${data?.error?.message || data?.error?.status || ""}`.trim(),
    );
    return null;
  }

  const meters = data.routes?.[0]?.distanceMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) {
    return null;
  }
  return metersToMiles(meters);
}

async function drivingDistanceWithOsrm(
  from: GeoPoint,
  to: GeoPoint,
): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const res = await fetch(url, { next: { revalidate: 0 } } as NextFetchInit);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ distance: number }>;
  };
  if (data.code !== "Ok" || !data.routes?.[0]) return null;
  return metersToMiles(data.routes[0].distance);
}

export async function drivingDistanceMiles(
  from: GeoPoint,
  to: GeoPoint,
): Promise<number | null> {
  if (googleMapsApiKey()) {
    const miles = await drivingDistanceWithGoogle(from, to);
    if (miles != null) return miles;
    console.warn("Google Routes unavailable; falling back to OpenStreetMap routing");
  }
  return drivingDistanceWithOsrm(from, to);
}

export async function geocodeBaseAddress(formatted: string) {
  if (cachedBasePoint !== undefined) return cachedBasePoint;
  cachedBasePoint = await geocodeAddress(formatted);
  return cachedBasePoint;
}
