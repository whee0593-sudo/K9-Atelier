import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { listAdminCalendarMonth } from "@/lib/appointments/calendar";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  const result = await listAdminCalendarMonth(month);
  if ("error" in result) {
    if (result.error === "conflict") {
      return staffJsonError("Choose a month as YYYY-MM.", 400);
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json(result);
}
