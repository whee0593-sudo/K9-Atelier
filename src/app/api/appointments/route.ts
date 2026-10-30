import { NextResponse } from "next/server";
import {
  handleAppointmentRouteError,
  mapAppointmentServiceError,
} from "@/lib/appointments/errors";
import {
  createAppointment,
  listCustomerAppointments,
} from "@/lib/appointments/service";
import {
  requireBookingPolicyConsent,
  validateCreateAppointmentInput,
} from "@/lib/appointments/validation";

export async function GET() {
  const result = await listCustomerAppointments();

  if ("error" in result) {
    return mapAppointmentServiceError(result.error);
  }

  return NextResponse.json({ appointments: result.appointments });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    requireBookingPolicyConsent(body);
    const input = validateCreateAppointmentInput(body);
    const result = await createAppointment(input);

    if ("error" in result) {
      return mapAppointmentServiceError(
        result.error,
        result.error === "price_changed" || result.error === "address_unverified"
          ? { message: result.message, quote: result.quote }
          : result.error === "invalid_selection"
            ? { message: result.message }
            : undefined,
      );
    }

    return NextResponse.json({ appointment: result.appointment }, { status: 201 });
  } catch (error) {
    return handleAppointmentRouteError(error);
  }
}
