import { NextResponse } from "next/server";
import { AppointmentValidationError } from "@/lib/appointments/validation";

export function appointmentJsonError(
  message: string,
  status: 400 | 401 | 404 | 409 | 500,
  field?: string,
) {
  return NextResponse.json(
    field ? { error: message, field } : { error: message },
    { status },
  );
}

export function handleAppointmentRouteError(error: unknown) {
  if (error instanceof AppointmentValidationError) {
    return appointmentJsonError(error.message, 400, error.field);
  }

  console.error("Appointment route error:", error);
  return appointmentJsonError("Something went wrong. Please try again.", 500);
}

export function mapAppointmentServiceError(
  error: "unauthenticated" | "not_found" | "conflict" | "server",
) {
  switch (error) {
    case "unauthenticated":
      return appointmentJsonError("Sign in required.", 401);
    case "not_found":
      return appointmentJsonError("Pet not found.", 404);
    case "conflict":
      return appointmentJsonError(
        "This pet is not ready to book yet. Please update vaccination records first.",
        409,
      );
    default:
      return appointmentJsonError("Something went wrong. Please try again.", 500);
  }
}
