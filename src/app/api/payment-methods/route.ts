import { NextResponse } from "next/server";
import {
  listCustomerPaymentMethods,
  saveSetupIntentPaymentMethod,
} from "@/lib/payments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function GET() {
  const result = await listCustomerPaymentMethods();
  if ("error" in result) {
    if (result.error === "unauthenticated") {
      return staffJsonError("Sign in required.", 401);
    }
    return staffJsonError("Something went wrong. Please try again.", 500);
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const setupIntentId =
    typeof body === "object" &&
    body !== null &&
    "setupIntentId" in body &&
    typeof body.setupIntentId === "string"
      ? body.setupIntentId.trim()
      : "";

  if (!setupIntentId) {
    return staffJsonError("Setup intent is required.", 400);
  }

  const result = await saveSetupIntentPaymentMethod(setupIntentId);
  if ("error" in result) {
    if (result.error === "unauthenticated") {
      return mapStaffServiceError("unauthenticated");
    }
    if (result.error === "misconfigured") {
      return staffJsonError(
        "Card setup is not available yet. Please contact the Atelier.",
        503,
      );
    }
    if (result.error === "conflict") {
      return staffJsonError("This card could not be verified. Please try another card.", 409);
    }
    return mapStaffServiceError("server");
  }

  return NextResponse.json({ method: result.method }, { status: 201 });
}
