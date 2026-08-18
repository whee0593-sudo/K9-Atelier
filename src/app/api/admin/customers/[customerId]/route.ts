import { NextResponse } from "next/server";
import { updateStaffCustomerProfile } from "@/lib/profiles/service";
import {
  ProfileValidationError,
  validateCustomerId,
  validateProfileWriteInput,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const input = validateProfileWriteInput(body);
    const result = await updateStaffCustomerProfile(customerId, input);
    if ("error" in result) {
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ profile: result.profile });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("PATCH /api/admin/customers failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
