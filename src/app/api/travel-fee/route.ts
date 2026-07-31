import { NextResponse } from "next/server";
import { calculateTravelFee, getBaseAddressFormatted } from "@/lib/travel";

type GeoPoint = { lat: number; lon: number };

async function geocodeAddress(query: string): Promise<GeoPoint | null> {
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
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

async function drivingDistanceMiles(
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
  const meters = data.routes[0].distance;
  return meters / 1609.344;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };

    const street = body.street?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const state = (body.state?.trim() || "FL").toUpperCase();
    const zip = body.zip?.trim() ?? "";

    if (!street || !city || !zip) {
      return NextResponse.json(
        { error: "Please enter street, city, and ZIP code." },
        { status: 400 },
      );
    }

    const base = getBaseAddressFormatted();
    if (!base) {
      return NextResponse.json(
        { error: "Base address is not configured." },
        { status: 500 },
      );
    }

    const customerQuery = `${street}, ${city}, ${state} ${zip}`;
    const [from, to] = await Promise.all([
      geocodeAddress(base),
      geocodeAddress(customerQuery),
    ]);

    if (!from || !to) {
      return NextResponse.json(
        {
          error:
            "We could not locate that address. Please check the spelling and ZIP code.",
        },
        { status: 422 },
      );
    }

    const miles = await drivingDistanceMiles(from, to);
    if (miles == null) {
      return NextResponse.json(
        {
          error:
            "We could not calculate driving distance. Please try again in a moment.",
        },
        { status: 502 },
      );
    }

    const quote = calculateTravelFee(miles);

    return NextResponse.json({
      address: { street, city, state, zip },
      quote,
    });
  } catch {
    return NextResponse.json(
      { error: "Travel fee calculation failed. Please try again." },
      { status: 500 },
    );
  }
}
