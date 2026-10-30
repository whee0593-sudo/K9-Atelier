import { NextResponse } from "next/server";
import {
  handleAppointmentRouteError,
  mapAppointmentServiceError,
} from "@/lib/appointments/errors";
import { createGroupAppointment } from "@/lib/appointments/group-service";
import { validateGroupBookingInput } from "@/lib/booking/group";
import { requireBookingPolicyConsent } from "@/lib/appointments/validation";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    requireBookingPolicyConsent(body);
    const result = await createGroupAppointment(
      validateGroupBookingInput(body),
    );
    if ("error" in result) {
      if (result.error === "price_changed")
        return NextResponse.json(
          { error: result.message, quotes: result.quotes },
          { status: 409 },
        );
      return mapAppointmentServiceError(result.error, {
        message: result.message,
      });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAppointmentRouteError(error);
  }
}
