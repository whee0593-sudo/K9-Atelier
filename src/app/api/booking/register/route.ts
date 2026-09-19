import { NextResponse } from "next/server";
import { registerBookingCustomer } from "@/lib/booking/register";
import { validateBookingRegisterInput } from "@/lib/booking/register-input";
import { jsonError } from "@/lib/pets/errors";
import { ProfileValidationError } from "@/lib/profiles/validation";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "bookingRegister");
  if (limited) return limited;

  try {
    const body: unknown = await request.json();
    const input = validateBookingRegisterInput(body);
    const result = await registerBookingCustomer(input);

    if ("error" in result) {
      if (result.error === "conflict") {
        return jsonError(result.message, 409, "email");
      }
      if (result.error === "frozen") {
        return jsonError(result.message, 403, "email");
      }
      if (result.error === "misconfigured") {
        return jsonError(result.message, 503);
      }
      return jsonError(result.message, 500);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("POST /api/booking/register failed:", error);
    return jsonError("Could not create your account. Please try again.", 500);
  }
}
