import { NextResponse } from "next/server";
import { createConfirmAccountSetupIntent } from "@/lib/staff/confirm-customer-booking";
import { staffJsonError } from "@/lib/staff/api-errors";
import { enforceIpRateLimit } from "@/lib/rate-limit";

function readToken(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "token" in body &&
    typeof body.token === "string"
  ) {
    return body.token.trim();
  }
  return "";
}

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "confirmAccount");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const token = readToken(body);
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return staffJsonError("This confirmation link is not valid.", 404);
  }

  const result = await createConfirmAccountSetupIntent(token);
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
    return staffJsonError("Something went wrong. Please try again.", 500);
  }

  return NextResponse.json({
    clientSecret: result.clientSecret,
    publishableKey: result.publishableKey,
  });
}
