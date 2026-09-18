import { setStaffCustomerPassword } from "@/lib/profiles/staff-service";
import {
  ProfileValidationError,
  validateCustomerId,
  validateStaffPassword,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const password = validateStaffPassword(body);
    const result = await setStaffCustomerPassword(customerId, password);
    if ("error" in result) {
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("POST /api/admin/customers/[customerId]/password failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
