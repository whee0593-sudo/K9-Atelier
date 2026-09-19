import { NextResponse } from "next/server";
import { bookingDurationMinutes } from "@/lib/booking-flow";
import {
  assignArrivalWindow,
  getAvailabilityForAddress,
  getBaseGeoPoint,
} from "@/lib/appointments/schedule";
import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { enforceIpRateLimit } from "@/lib/rate-limit";

function readPoint(url: URL) {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export async function GET(request: Request) {
  const limited = enforceIpRateLimit(request, "bookingAvailability");
  if (limited) return limited;

  const url = new URL(request.url);
  const point = readPoint(url);
  const zip = url.searchParams.get("zip")?.trim() ?? "";
  const serviceId = url.searchParams.get("serviceId")?.trim() ?? "";
  const weightLbs = Number(url.searchParams.get("weightLbs"));
  const addOnIds = (url.searchParams.get("addOnIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!point || !zip || !Number.isFinite(weightLbs)) {
    return NextResponse.json(
      { error: "Address details are required." },
      { status: 400 },
    );
  }

  const base = await getBaseGeoPoint();
  if (!base) {
    return NextResponse.json(
      { error: "Could not locate the studio base for routing." },
      { status: 500 },
    );
  }

  const result = await getAvailabilityForAddress({
    point,
    zip,
    durationMinutes: bookingDurationMinutes(serviceId, weightLbs, addOnIds),
    base,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: "Could not load available dates." },
      { status: 500 },
    );
  }

  return NextResponse.json({ days: result.days });
}

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "bookingAvailability");
  if (limited) return limited;

  let body: {
    lat?: number;
    lon?: number;
    zip?: string;
    serviceId?: string;
    weightLbs?: number;
    addOnIds?: string[];
    date?: string;
    slotStartMinutes?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const point =
    typeof body.lat === "number" && typeof body.lon === "number"
      ? { lat: body.lat, lon: body.lon }
      : null;
  const zip = body.zip?.trim() ?? "";
  const serviceId = body.serviceId?.trim() ?? "";
  const date = body.date?.trim() ?? "";
  const slotStartMinutes = body.slotStartMinutes;
  const weightLbs = body.weightLbs;
  const addOnIds = Array.isArray(body.addOnIds)
    ? body.addOnIds.filter((id): id is string => typeof id === "string")
    : [];

  if (
    !point ||
    !zip ||
    !date ||
    typeof slotStartMinutes !== "number" ||
    !listHourlyStartMinutes().includes(slotStartMinutes) ||
    typeof weightLbs !== "number"
  ) {
    return NextResponse.json(
      { error: "Date, start time, and address are required." },
      { status: 400 },
    );
  }

  if (!isDateBookable(parseDateValue(date))) {
    return NextResponse.json(
      { error: "That date is not available for booking." },
      { status: 409 },
    );
  }

  const base = await getBaseGeoPoint();
  if (!base) {
    return NextResponse.json(
      { error: "Could not locate the studio base for routing." },
      { status: 500 },
    );
  }

  const result = await assignArrivalWindow({
    date,
    point,
    zip,
    durationMinutes: bookingDurationMinutes(serviceId, weightLbs, addOnIds),
    slotStartMinutes,
    base,
  });

  if ("error" in result) {
    if (result.error === "slot_unavailable") {
      return NextResponse.json(
        {
          error:
            "That start time is fully booked or no longer available for this address. Please choose another time.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not assign an arrival window." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    appointmentTime: result.insertion.appointmentTime,
    scheduledStart: result.insertion.scheduledStart,
    slotStartMinutes: result.insertion.scheduledStart,
    usedPreference: result.insertion.usedPreference,
  });
}
