import { NextResponse } from "next/server";
import { AppointmentValidationError, validateAppointmentId } from "@/lib/appointments/validation";
import { parseStaffRescheduleInput } from "@/lib/appointments/staff-reschedule-input";
import { rescheduleStaffAppointment } from "@/lib/appointments/staff-reschedule";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return staffJsonError("Invalid request body.", 400);
    }

    const parsed = parseStaffRescheduleInput(body);
    if ("error" in parsed) {
      return staffJsonError(parsed.error, 400);
    }

    const result = await rescheduleStaffAppointment(
      appointmentId,
      parsed.date,
      parsed.slotStartMinutes,
    );

    if ("error" in result) {
      if (result.error === "slot_unavailable") {
        return staffJsonError(
          "That date or time is blocked, or another visit already starts at that minute.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json({ appointment: result.appointment });
  } catch (error) {
    if (error instanceof AppointmentValidationError) {
      return staffJsonError(error.message, 400);
    }
    return mapStaffServiceError("not_found");
  }
}
