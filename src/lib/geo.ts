export type GeoPoint = { lat: number; lon: number };
export type DrivingRoute = { miles: number; minutes: number };
export type RouteLookup = (from: GeoPoint, to: GeoPoint) => DrivingRoute | null;

function googleMapsApiKey() {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
}

export function isGoogleMapsConfigured() {
  return Boolean(googleMapsApiKey());
}

export function resetGeoCache() {
  cachedBase = undefined;
}

export function routeKey(from: GeoPoint, to: GeoPoint) {
  return `${from.lat},${from.lon}>${to.lat},${to.lon}`;
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const key = googleMapsApiKey();
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      status?: string;
      results?: Array<{ partial_match?: boolean; geometry?: {
        location_type?: string;
        location?: { lat: number; lng: number };
      } }>;
    };
    const result = data.results?.[0];
    const location = result?.geometry?.location;
    if (data.status !== "OK" || result?.partial_match || !location ||
        !["ROOFTOP", "RANGE_INTERPOLATED"].includes(result?.geometry?.location_type ?? "") ||
        !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
    return { lat: location.lat, lon: location.lng };
  } catch {
    return null;
  }
}

export async function getDrivingRoute(from: GeoPoint, to: GeoPoint): Promise<DrivingRoute | null> {
  const key = googleMapsApiKey();
  if (!key) return null;
  if (from.lat === to.lat && from.lon === to.lon) return { miles: 0, minutes: 0 };

  const waypoint = ({ lat, lon }: GeoPoint) => ({
    location: { latLng: { latitude: lat, longitude: lon } },
  });

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: waypoint(from),
        destination: waypoint(to),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      routes?: Array<{ distanceMeters?: number; duration?: string }>;
    };
    const route = data.routes?.[0];
    const meters = route?.distanceMeters;
    const duration = route?.duration;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0 ||
        typeof duration !== "string" || !/^\d+(\.\d+)?s$/.test(duration)) return null;
    return { miles: meters / 1609.344, minutes: Number(duration.slice(0, -1)) / 60 };
  } catch {
    return null;
  }
}

export async function drivingDistanceMiles(from: GeoPoint, to: GeoPoint) {
  return (await getDrivingRoute(from, to))?.miles ?? null;
}

let cachedBase: { address: string; point: GeoPoint } | undefined;

export async function geocodeBaseAddress(address: string) {
  if (cachedBase?.address === address) return cachedBase.point;
  const point = await geocodeAddress(address);
  if (point) cachedBase = { address, point };
  return point;
}
