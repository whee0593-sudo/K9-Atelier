import { NextResponse } from "next/server";
import { calculateTravelFee } from "@/lib/travel";
import { drivingDistanceMiles, geocodeAddress } from "@/lib/geo";
import { enforceIpRateLimit } from "@/lib/rate-limit";
import { getBaseAddressFormatted } from "@/lib/server/base-address";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "travelFee");
  if (limited) return limited;

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
      quote: {
        ...quote,
        lat: to.lat,
        lon: to.lon,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Travel fee calculation failed. Please try again." },
      { status: 500 },
    );
  }
}
