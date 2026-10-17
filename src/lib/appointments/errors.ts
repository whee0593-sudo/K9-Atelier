import { NextResponse } from "next/server";
import { AppointmentValidationError } from "@/lib/appointments/validation";
import type { BookingPriceQuote } from "@/lib/booking-price";
import { PRICE_CHANGED_MESSAGE } from "@/lib/booking-price";
import { ALLERGY_PROFILE_UNAVAILABLE_MESSAGE } from "@/lib/allergies";
import { WEIGHT_REQUIRED_MESSAGE } from "@/lib/pets/weight";

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
  error:
    | "unauthenticated"
    | "not_found"
    | "conflict"
    | "slot_unavailable"
    | "payment_required"
    | "weight_required"
    | "invalid_selection"
    | "price_changed"
    | "address_unverified"
    | "idempotency_mismatch"
    | "allergy_unavailable"
    | "server",
  extra?: { message?: string; quote?: BookingPriceQuote },
) {
  switch (error) {
    case "unauthenticated":
      return appointmentJsonError("Sign in required.", 401);
    case "not_found":
      return appointmentJsonError("Pet not found.", 404);
    case "conflict":
      return appointmentJsonError(
        "This appointment could not be saved. Please check the details and try again.",
        409,
      );
    case "slot_unavailable":
      return appointmentJsonError(
        "That day is fully booked or no longer available for this address. Please choose another date.",
        409,
        "appointmentDate",
      );
    case "payment_required":
      return appointmentJsonError(
        "Please select a saved payment method for this appointment.",
        409,
      );
    case "weight_required":
      return appointmentJsonError(
        WEIGHT_REQUIRED_MESSAGE,
        409,
        "weightLbs",
      );
    case "invalid_selection":
      return appointmentJsonError(
        extra?.message ?? "That service cannot be booked.",
        400,
        "serviceId",
      );
    case "price_changed":
      return NextResponse.json(
        {
          error: extra?.message ?? PRICE_CHANGED_MESSAGE,
          field: "estimatedTotal",
          code: "price_changed",
          quote: extra?.quote ?? null,
        },
        { status: 409 },
      );
    case "address_unverified":
      return NextResponse.json(
        {
          error:
            extra?.message ??
            "We could not verify that address. Please check it and try again.",
          field: "address",
          code: "address_unverified",
        },
        { status: 422 },
      );
    case "idempotency_mismatch":
      return NextResponse.json(
        {
          error:
            "This confirmation does not match the appointment you started. Review the details and confirm again.",
          code: "idempotency_mismatch",
        },
        { status: 409 },
      );
    case "allergy_unavailable":
      return NextResponse.json(
        {
          error: extra?.message ?? ALLERGY_PROFILE_UNAVAILABLE_MESSAGE,
          code: "allergy_unavailable",
        },
        { status: 503 },
      );
    default:
      return appointmentJsonError("Something went wrong. Please try again.", 500);
  }
}
