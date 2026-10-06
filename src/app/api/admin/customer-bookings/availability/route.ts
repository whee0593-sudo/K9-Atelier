import { NextResponse } from "next/server";
import { getAvailabilityForAddress, getBaseGeoPoint } from "@/lib/appointments/schedule";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { getStaffSession } from "@/lib/staff/auth";
import { enforceIpRateLimit } from "@/lib/rate-limit";

const MAX_VISITS = 16;
const MAX_VISIT_MINUTES = 24 * 60;

function readPoint(url: URL) {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function readDurations(url: URL) {
  const raw = url.searchParams.get("durations")?.trim() ?? "";
  if (!raw) return null;
  const durations = raw.split(",").map((part) => Number(part.trim()));
  if (
    durations.length === 0 ||
    durations.length > MAX_VISITS ||
    durations.some(
      (minutes) =>
        !Number.isInteger(minutes) ||
        minutes <= 0 ||
        minutes > MAX_VISIT_MINUTES,
    )
  ) {
    return null;
  }
  return durations;
}

export async function GET(request: Request) {
  const limited = enforceIpRateLimit(request, "bookingAvailability");
  if (limited) return limited;

  const session = await getStaffSession();
  if ("error" in session) return mapStaffServiceError(session.error);

  const url = new URL(request.url);
  const point = readPoint(url);
  const zip = url.searchParams.get("zip")?.trim() ?? "";
  const durations = readDurations(url);
  if (!point || !zip || !durations) {
    return staffJsonError("Address and service times are required.", 400);
  }

  const base = await getBaseGeoPoint();
  if (!base) {
    return staffJsonError("Could not locate the studio base for routing.", 500);
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
    durationMinutes: durations[0]!,
    visitDurations: durations,
    base,
    extraDates,
  });

  if ("error" in result) {
    return staffJsonError("Could not load available dates.", 500);
  }

  return NextResponse.json(
    { days: result.days },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
