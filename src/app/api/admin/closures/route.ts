import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { setStaffDayClosure } from "@/lib/appointments/schedule";
import { listClosureHourOptions } from "@/lib/appointments/closures";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if ("error" in session) return mapStaffServiceError(session.error);

  let body: {
    date?: string;
    clear?: boolean;
    closedAllDay?: boolean;
    closedHours?: number[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const date = body.date?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return staffJsonError("Date must be YYYY-MM-DD.", 400);
  }

  if (!isDateBookable(parseDateValue(date))) {
    return staffJsonError("That date is outside the booking calendar.", 400);
  }

  const allowed = new Set(listClosureHourOptions());
  const closedHours = Array.isArray(body.closedHours)
    ? body.closedHours.filter(
        (hour): hour is number =>
          Number.isInteger(hour) && allowed.has(hour),
      )
    : [];

  const result = body.clear
    ? await setStaffDayClosure(date, { clear: true })
    : await setStaffDayClosure(date, {
        closedAllDay: Boolean(body.closedAllDay),
        closedHours,
      });

  if ("error" in result) {
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json({ ok: true });
}
