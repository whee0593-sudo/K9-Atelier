import { NextResponse } from "next/server";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { setAppointmentStatus } from "@/lib/appointments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return staffJsonError("Invalid request body.", 400);
    }

    const status =
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      (body.status === "confirmed" || body.status === "cancelled")
        ? body.status
        : null;

    if (!status) {
      return staffJsonError('Status must be "confirmed" or "cancelled".', 400);
    }

    const result = await setAppointmentStatus(appointmentId, status);

    if ("error" in result) {
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return mapStaffServiceError("not_found");
  }
}
