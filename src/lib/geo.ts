export type GeoPoint = { lat: number; lon: number };

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
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
  });

  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

export async function drivingDistanceMiles(
  from: GeoPoint,
  to: GeoPoint,
): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ distance: number }>;
  };
  if (data.code !== "Ok" || !data.routes?.[0]) return null;
  return data.routes[0].distance / 1609.344;
}

let cachedBasePoint: GeoPoint | null | undefined;

export async function geocodeBaseAddress(formatted: string) {
  if (cachedBasePoint !== undefined) return cachedBasePoint;
  cachedBasePoint = await geocodeAddress(formatted);
  return cachedBasePoint;
}
