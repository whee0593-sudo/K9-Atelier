import { NextResponse } from "next/server";
import { AppointmentValidationError, validateAppointmentId } from "@/lib/appointments/validation";
import { listStaffAppointmentAvailability } from "@/lib/appointments/staff-reschedule";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);
    const serviceId = new URL(request.url).searchParams.get("serviceId") ?? undefined;
    const result = await listStaffAppointmentAvailability(appointmentId, serviceId);

    if ("error" in result) {
      if (result.error === "invalid_service") {
        return staffJsonError(result.message ?? "This service is unavailable for this appointment.", 400);
      }
      if (result.error === "slot_unavailable") {
        return staffJsonError(
          "That start time is fully booked or no longer available.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json(
      { days: result.days, visit: result.visit },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AppointmentValidationError) {
      return staffJsonError(error.message, 400);
    }
    return mapStaffServiceError("not_found");
  }
}
