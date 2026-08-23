import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import {
  listAdminAppointmentsOnDate,
  listPendingAdminAppointments,
  listTodayConfirmedAdminAppointments,
} from "@/lib/appointments/service";
import { listAdminScheduleDays } from "@/lib/appointments/schedule";
import { getRoutingConfig, zoneLabel } from "@/lib/booking-schedule";
import { listPaidKindsByAppointment } from "@/lib/charges/service";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (date) {
    const day = await listAdminAppointmentsOnDate(date);
    if ("error" in day) {
      if (day.error === "conflict") {
        return staffJsonError("Choose a date as YYYY-MM-DD.", 400);
      }
      return mapStaffServiceError(day.error);
    }
    const paidKinds = await listPaidKindsByAppointment(
      day.appointments.map((appointment) => appointment.id),
    );
    return NextResponse.json({
      appointments: day.appointments,
      paidKinds,
    });
  }

  const pending = await listPendingAdminAppointments();

  if ("error" in pending) {
    return mapStaffServiceError(pending.error);
  }

  const today = await listTodayConfirmedAdminAppointments();
  const todayAppointments = "error" in today ? [] : today.appointments;
  const paidKinds = await listPaidKindsByAppointment(
    todayAppointments.map((appointment) => appointment.id),
  );
  const schedule = await listAdminScheduleDays();
  const routing = getRoutingConfig();

  return NextResponse.json({
    appointments: pending.appointments,
    today: todayAppointments,
    paidKinds,
    schedule: "error" in schedule ? [] : schedule.days,
    zones: [
      { id: "auto", label: "Auto" },
      ...routing.zones.map((zone) => ({ id: zone.id, label: zoneLabel(zone.id) })),
    ],
  });
}
