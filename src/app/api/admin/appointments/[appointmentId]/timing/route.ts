import { NextResponse } from "next/server";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { setAppointmentVisitTiming } from "@/lib/appointments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId: rawId } = await context.params;
    const appointmentId = validateAppointmentId(rawId);
    const body = (await request.json()) as { action?: string };
    if (body.action !== "check_in" && body.action !== "check_out") {
      return staffJsonError("Choose check in or check out.", 400);
    }

    const result = await setAppointmentVisitTiming(appointmentId, body.action);
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError("Check in before you check out.", 409);
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json(result);
  } catch {
    return mapStaffServiceError("not_found");
  }
}
