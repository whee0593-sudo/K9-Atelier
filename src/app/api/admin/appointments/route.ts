import { NextResponse } from "next/server";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import {
  listPendingAdminAppointments,
  listTodayConfirmedAdminAppointments,
} from "@/lib/appointments/service";

export async function GET() {
  const pending = await listPendingAdminAppointments();

  if ("error" in pending) {
    return mapStaffServiceError(pending.error);
  }

  const today = await listTodayConfirmedAdminAppointments();
  const todayAppointments = "error" in today ? [] : today.appointments;

  return NextResponse.json({
    appointments: pending.appointments,
    today: todayAppointments,
  });
}
