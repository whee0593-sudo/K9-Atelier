import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { estimateServiceDurationMinutes } from "@/lib/services";
import {
  assignArrivalWindow,
  getAvailabilityForAddress,
  getBaseGeoPoint,
} from "@/lib/appointments/schedule";
import type { TimePreference } from "@/lib/booking-schedule";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";

function readPoint(url: URL) {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const point = readPoint(url);
  const zip = url.searchParams.get("zip")?.trim() ?? "";
  const serviceId = url.searchParams.get("serviceId")?.trim() ?? "";
  const weightLbs = Number(url.searchParams.get("weightLbs"));
  const addOnIds = (url.searchParams.get("addOnIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!point || !zip || !serviceId || !Number.isFinite(weightLbs)) {
    return NextResponse.json(
      { error: "Address and service details are required." },
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
    durationMinutes: estimateServiceDurationMinutes(serviceId, weightLbs, addOnIds),
    base,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: "Could not load available dates." },
      { status: result.error === "misconfigured" ? 500 : 500 },
    );
  }

  return NextResponse.json({ days: result.days });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: {
    lat?: number;
    lon?: number;
    zip?: string;
    serviceId?: string;
    weightLbs?: number;
    addOnIds?: string[];
    date?: string;
    timePreference?: string;
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
  const preference = body.timePreference;
  const weightLbs = body.weightLbs;
  const addOnIds = Array.isArray(body.addOnIds)
    ? body.addOnIds.filter((id): id is string => typeof id === "string")
    : [];

  if (
    !point ||
    !zip ||
    !serviceId ||
    !date ||
    (preference !== "morning" && preference !== "afternoon") ||
    typeof weightLbs !== "number"
  ) {
    return NextResponse.json(
      { error: "Date, time of day, and address are required." },
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
    durationMinutes: estimateServiceDurationMinutes(serviceId, weightLbs, addOnIds),
    preference: preference as TimePreference,
    base,
  });

  if ("error" in result) {
    if (result.error === "slot_unavailable") {
      return NextResponse.json(
        {
          error:
            "That day is fully booked or no longer available for this address. Please choose another date.",
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
    usedPreference: result.insertion.usedPreference,
  });
}
