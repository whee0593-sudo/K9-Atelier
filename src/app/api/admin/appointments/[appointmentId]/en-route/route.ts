import { NextResponse } from "next/server";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { sendAppointmentEnRouteNotification } from "@/lib/appointments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { appointmentId: rawAppointmentId } = await context.params;
    const appointmentId = validateAppointmentId(rawAppointmentId);
    const body = await request.json().catch(() => null);
    const time = body?.estimatedArrivalTime;
    if (typeof time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return staffJsonError("Enter a valid estimated arrival time.", 400);
    }
    const [hours, minutes] = time.split(":").map(Number);
    const result = await sendAppointmentEnRouteNotification(appointmentId, hours * 60 + minutes);

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
