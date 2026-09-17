import { NextResponse } from "next/server";
import { AppointmentValidationError, validateAppointmentId } from "@/lib/appointments/validation";
import { listStaffAppointmentAvailability } from "@/lib/appointments/staff-reschedule";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);
    const result = await listStaffAppointmentAvailability(appointmentId);

    if ("error" in result) {
      if (result.error === "slot_unavailable") {
        return staffJsonError(
          "That start time is fully booked or no longer available.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json({ days: result.days });
  } catch (error) {
    if (error instanceof AppointmentValidationError) {
      return staffJsonError(error.message, 400);
    }
    return mapStaffServiceError("not_found");
  }
}
