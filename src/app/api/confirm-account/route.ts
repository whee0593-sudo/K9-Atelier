import { NextResponse } from "next/server";
import {
  confirmStaffCreatedBooking,
  getCustomerConfirmPreview,
} from "@/lib/staff/confirm-customer-booking";
import {
  StaffBookingValidationError,
  validateCustomerConfirmInput,
} from "@/lib/staff/create-customer-booking-input";
import { staffJsonError } from "@/lib/staff/api-errors";
import { enforceIpRateLimit } from "@/lib/rate-limit";

function mapConfirmError(
  error: "not_found" | "expired" | "frozen" | "conflict" | "misconfigured" | "server",
  message?: string,
) {
  switch (error) {
    case "not_found":
      return staffJsonError("This confirmation link is not valid.", 404);
    case "expired":
      return staffJsonError(
        "This confirmation link has expired. Please contact penny@k9atelier.com",
        410,
      );
    case "frozen":
      return staffJsonError(
        "Your account has been frozen. Please contact the administrator at penny@k9atelier.com",
        403,
      );
    case "conflict":
      return staffJsonError(
        message ?? "This appointment cannot be confirmed yet.",
        409,
      );
    case "misconfigured":
      return staffJsonError("This feature is not configured yet.", 500);
    default:
      return staffJsonError("Something went wrong. Please try again.", 500);
  }
}

export async function GET(request: Request) {
  const limited = enforceIpRateLimit(request, "confirmAccount");
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return staffJsonError("This confirmation link is not valid.", 404);
  }

  const result = await getCustomerConfirmPreview(token);
  if ("error" in result) return mapConfirmError(result.error);
  return NextResponse.json(result.preview);
}

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "confirmAccount");
  if (limited) return limited;

  try {
    const body: unknown = await request.json();
    const input = validateCustomerConfirmInput(body);
    const result = await confirmStaffCreatedBooking(input);
    if ("error" in result) {
      return mapConfirmError(result.error, result.message);
    }
    return NextResponse.json({
      appointment: result.appointment,
      email: result.email,
      signedInWithPassword: result.signedInWithPassword,
    });
  } catch (error) {
    if (error instanceof StaffBookingValidationError) {
      return staffJsonError(error.message, 400);
    }
    if (error instanceof SyntaxError) {
      return staffJsonError("Invalid request body.", 400);
    }
    console.error("POST /api/confirm-account failed:", error);
    return staffJsonError("Something went wrong. Please try again.", 500);
  }
}
