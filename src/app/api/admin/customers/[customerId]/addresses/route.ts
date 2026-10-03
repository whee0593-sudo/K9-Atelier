import { NextResponse } from "next/server";
import { rewriteStaffCustomerServiceAddress } from "@/lib/profiles/staff-addresses";
import {
  ProfileValidationError,
  validateCustomerId,
  validateStaffAddressRewriteInput,
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

    const { from, to } = validateStaffAddressRewriteInput(body);
    const result = await rewriteStaffCustomerServiceAddress(customerId, from, to);
    if ("error" in result) {
      if (result.error === "outside_area" || result.error === "not_found") {
        return staffJsonError(
          result.message ??
            (result.error === "not_found"
              ? "No visits use that address."
              : "That address is outside the service area."),
          400,
        );
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("PATCH /api/admin/customers/.../addresses failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
