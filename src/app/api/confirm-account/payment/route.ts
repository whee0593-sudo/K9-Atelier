import { NextResponse } from "next/server";
import { saveConfirmAccountPaymentMethod } from "@/lib/staff/confirm-customer-booking";
import { staffJsonError } from "@/lib/staff/api-errors";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "confirmAccount");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const token = typeof record.token === "string" ? record.token.trim() : "";
  const setupIntentId =
    typeof record.setupIntentId === "string" ? record.setupIntentId.trim() : "";

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return staffJsonError("This confirmation link is not valid.", 404);
  }
  if (!setupIntentId) {
    return staffJsonError("Setup intent is required.", 400);
  }

  const result = await saveConfirmAccountPaymentMethod(token, setupIntentId);
  if ("error" in result) {
    if (result.error === "not_found") {
      return staffJsonError("This confirmation link is not valid.", 404);
    }
    if (result.error === "expired") {
      return staffJsonError(
        "This confirmation link has expired. Please contact penny@k9atelier.com",
        410,
      );
    }
    if (result.error === "frozen") {
      return staffJsonError(
        "Your account has been frozen. Please contact the administrator at penny@k9atelier.com",
        403,
      );
    }
    if (result.error === "misconfigured") {
      return staffJsonError(
        "Card setup is not available yet. Please contact penny@k9atelier.com",
        503,
      );
    }
    if (result.error === "conflict") {
      return staffJsonError(
        "This card could not be verified. Please try another card.",
        409,
      );
    }
    return staffJsonError("Something went wrong. Please try again.", 500);
  }

  return NextResponse.json({ method: result.method }, { status: 201 });
}
