import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { setStaffDayZone } from "@/lib/appointments/schedule";
import { getRoutingConfig } from "@/lib/booking-schedule";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if ("error" in session) return mapStaffServiceError(session.error);

  let body: { date?: string; zoneId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const date = body.date?.trim() ?? "";
  const zoneId = body.zoneId?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return staffJsonError("Date must be YYYY-MM-DD.", 400);
  }

  const allowed = new Set([
    "auto",
    ...getRoutingConfig().zones.map((zone) => zone.id),
  ]);
  if (!allowed.has(zoneId)) {
    return staffJsonError("Unknown service area.", 400);
  }

  if (!isDateBookable(parseDateValue(date))) {
    return staffJsonError("That date is outside the booking calendar.", 400);
  }

  const result = await setStaffDayZone(date, zoneId);
  if ("error" in result) {
    if (result.error === "conflict") {
      return staffJsonError(
        "Existing appointments on that day are outside the selected area.",
        409,
      );
    }
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json({ ok: true });
}
