import { NextResponse } from "next/server";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { listPendingAdminAppointments } from "@/lib/appointments/service";

export async function GET() {
  const result = await listPendingAdminAppointments();

  if ("error" in result) {
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json({ appointments: result.appointments });
}
