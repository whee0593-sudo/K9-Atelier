import { NextResponse } from "next/server";
import {
  handleAppointmentRouteError,
  mapAppointmentServiceError,
} from "@/lib/appointments/errors";
import { createGroupAppointment } from "@/lib/appointments/group-service";
import { validateGroupBookingInput } from "@/lib/booking/group";

export async function POST(request: Request) {
  try {
    const result = await createGroupAppointment(
      validateGroupBookingInput(await request.json()),
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
