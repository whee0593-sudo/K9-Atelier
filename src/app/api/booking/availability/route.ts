import { NextResponse } from "next/server";
import { resolveArrivalForBooking } from "@/lib/appointments/arrival-window";
import { resolveAvailabilityDuration } from "@/lib/booking/availability-request";
import { isWithinServiceDay } from "@/lib/booking-schedule";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { WEIGHT_REQUIRED_MESSAGE } from "@/lib/pets/weight";
import { enforceIpRateLimit } from "@/lib/rate-limit";

function readPoint(url: URL) {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function weightRequiredResponse() {
  return NextResponse.json(
    { error: WEIGHT_REQUIRED_MESSAGE, field: "weightLbs" },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const limited = enforceIpRateLimit(request, "bookingAvailability");
  if (limited) return limited;

  const url = new URL(request.url);
  const point = readPoint(url);
  const zip = url.searchParams.get("zip")?.trim() ?? "";
  const serviceId = url.searchParams.get("serviceId")?.trim() ?? "";
  const weightLbs = url.searchParams.get("weightLbs");
  const durationOverride = Number(url.searchParams.get("durationMinutes"));
  const addOnIds = (url.searchParams.get("addOnIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!point || !zip) {
    return NextResponse.json(
      { error: "Address details are required." },
      { status: 400 },
    );
  }

  const duration = resolveAvailabilityDuration({
    serviceId,
    weightLbs,
    addOnIds,
    durationOverride,
  });
  if ("error" in duration) return weightRequiredResponse();

  const { getAvailabilityForAddress, getBaseGeoPoint } = await import(
    "@/lib/appointments/schedule"
  );
  const base = await getBaseGeoPoint();
  if (!base) {
    return NextResponse.json(
      { error: "Could not locate the studio base for routing." },
      { status: 500 },
    );
  }

  const requestedDate = url.searchParams.get("date")?.trim() ?? "";
  const extraDates =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    isDateBookable(parseDateValue(requestedDate))
      ? [requestedDate]
      : [];

  const result = await getAvailabilityForAddress({
    point,
    zip,
    durationMinutes: duration.durationMinutes,
    base,
    extraDates,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: "Could not load available dates." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { days: result.days },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "bookingAvailability");
  if (limited) return limited;

  let body: {
    lat?: number;
    lon?: number;
    zip?: string;
    serviceId?: string;
    weightLbs?: unknown;
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
  const addOnIds = Array.isArray(body.addOnIds)
    ? body.addOnIds.filter((id): id is string => typeof id === "string")
    : [];

  if (
    !point ||
    !zip ||
    !date ||
    typeof slotStartMinutes !== "number" ||
    !isWithinServiceDay(slotStartMinutes)
  ) {
    return NextResponse.json(
      { error: "Date, start time, and address are required." },
      { status: 400 },
    );
  }

  const duration = resolveAvailabilityDuration({
    serviceId,
    weightLbs: body.weightLbs,
    addOnIds,
  });
  if ("error" in duration) return weightRequiredResponse();

  if (!isDateBookable(parseDateValue(date))) {
    return NextResponse.json(
      { error: "That date is not available for booking." },
      { status: 409 },
    );
  }

  const { assignArrivalWindow, getBaseGeoPoint } = await import(
    "@/lib/appointments/schedule"
  );
  const base = await getBaseGeoPoint();
  const result = base
    ? await assignArrivalWindow({
        date,
        point,
        zip,
        durationMinutes: duration.durationMinutes,
        slotStartMinutes,
        base,
      })
    : { error: "misconfigured" as const };
  const schedule = resolveArrivalForBooking(result, slotStartMinutes);

  if ("error" in schedule) {
    return NextResponse.json(
      {
        error:
          "That start time is fully booked or no longer available for this address. Please choose another time.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    appointmentTime: schedule.appointmentTime,
    scheduledStart: schedule.scheduledStart,
    slotStartMinutes: schedule.scheduledStart,
    usedPreference: schedule.timePreference,
  });
}
