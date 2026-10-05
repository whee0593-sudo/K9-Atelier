import { NextResponse } from "next/server";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { sendAppointmentEnRouteNotification } from "@/lib/appointments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);
    const result = await sendAppointmentEnRouteNotification(appointmentId);

    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError(
          "This on-the-way text cannot be sent. Add a mobile number on file, or it was already sent.",
          409,
        );
      }
      if (result.error === "misconfigured") {
        return staffJsonError(
          "SMS is not configured yet. Add Twilio keys in Vercel to send texts.",
          500,
        );
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return mapStaffServiceError("not_found");
  }
}
