import { NextResponse } from "next/server";
import {
  handleAppointmentRouteError,
  mapAppointmentServiceError,
} from "@/lib/appointments/errors";
import {
  createAppointment,
  listCustomerAppointments,
} from "@/lib/appointments/service";
import { validateCreateAppointmentInput } from "@/lib/appointments/validation";

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
    const input = validateCreateAppointmentInput(body);
    const result = await createAppointment(input);

    if ("error" in result) {
      return mapAppointmentServiceError(result.error);
    }

    return NextResponse.json({ appointment: result.appointment }, { status: 201 });
  } catch (error) {
    return handleAppointmentRouteError(error);
  }
}
