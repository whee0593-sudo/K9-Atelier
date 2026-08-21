import { NextResponse } from "next/server";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import {
  listPendingAdminAppointments,
  listTodayConfirmedAdminAppointments,
} from "@/lib/appointments/service";
import { listAdminScheduleDays } from "@/lib/appointments/schedule";
import { getRoutingConfig, zoneLabel } from "@/lib/booking-schedule";

export async function GET() {
  const pending = await listPendingAdminAppointments();

  if ("error" in pending) {
    return mapStaffServiceError(pending.error);
  }

  const today = await listTodayConfirmedAdminAppointments();
  const todayAppointments = "error" in today ? [] : today.appointments;
  const schedule = await listAdminScheduleDays();
  const routing = getRoutingConfig();

  return NextResponse.json({
    appointments: pending.appointments,
    today: todayAppointments,
    schedule: "error" in schedule ? [] : schedule.days,
    zones: [
      { id: "auto", label: "Auto" },
      ...routing.zones.map((zone) => ({ id: zone.id, label: zoneLabel(zone.id) })),
    ],
  });
}
