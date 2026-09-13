import { NextResponse } from "next/server";
import { setStaffCustomerFrozen } from "@/lib/profiles/staff-service";
import {
  ProfileValidationError,
  validateCustomerId,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);

    let body: { frozen?: unknown };
    try {
      body = (await request.json()) as { frozen?: unknown };
    } catch {
      return jsonError("Invalid request body.", 400);
    }
    if (typeof body.frozen !== "boolean") {
      return jsonError("Frozen state is required.", 400);
    }

    const result = await setStaffCustomerFrozen(customerId, body.frozen);
    if ("error" in result) {
      if (result.message && (result.error === "conflict" || result.error === "forbidden")) {
        return staffJsonError(
          result.message,
          result.error === "conflict" ? 409 : 403,
        );
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ frozen: result.frozen });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("POST /api/admin/customers/freeze failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
