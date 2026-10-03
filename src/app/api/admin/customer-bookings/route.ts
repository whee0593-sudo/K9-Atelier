import { NextResponse } from "next/server";
import { createStaffCustomerBooking } from "@/lib/staff/create-customer-booking";
import {
  StaffBookingValidationError,
  validateStaffCustomerBookingInput,
} from "@/lib/staff/create-customer-booking-input";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "staffBooking");
  if (limited) return limited;

  try {
    const body: unknown = await request.json();
    const input = validateStaffCustomerBookingInput(body);
    const result = await createStaffCustomerBooking(input);

    if ("error" in result) {
      if (result.error === "slot_unavailable") {
        return staffJsonError(
          "That start time is no longer available for this address.",
          409,
        );
      }
      if (result.error === "outside_area") {
        return staffJsonError(
          result.message ?? "That address is outside the service area.",
          409,
        );
      }
      if (result.error === "conflict") {
        return staffJsonError(
          result.message ?? "This customer cannot be booked this way.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json(
      {
        mode: result.booking.mode,
        confirmUrl: result.booking.confirmUrl,
        emailed: result.booking.emailed,
        texted: result.booking.texted,
        customer: result.booking.customer,
        appointment: result.booking.appointment
          ? {
              serviceName: result.booking.appointment.serviceName,
              appointmentDate: result.booking.appointment.appointmentDate,
              appointmentTime: result.booking.appointment.appointmentTime,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof StaffBookingValidationError) {
      return staffJsonError(error.message, 400);
    }
    if (error instanceof SyntaxError) {
      return staffJsonError("Invalid request body.", 400);
    }
    console.error("POST /api/admin/customer-bookings failed:", error);
    return staffJsonError("Something went wrong. Please try again.", 500);
  }
}
