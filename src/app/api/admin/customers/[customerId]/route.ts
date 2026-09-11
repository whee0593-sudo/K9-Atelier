import { NextResponse } from "next/server";
import { deleteStaffCustomer } from "@/lib/profiles/staff-service";
import { updateStaffCustomerProfile } from "@/lib/profiles/service";
import {
  ProfileValidationError,
  validateCustomerId,
  validateProfileWriteInput,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);
    const result = await deleteStaffCustomer(customerId);
    if ("error" in result) {
      if (result.message && (result.error === "conflict" || result.error === "forbidden")) {
        return staffJsonError(
          result.message,
          result.error === "conflict" ? 409 : 403,
        );
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("DELETE /api/admin/customers failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
