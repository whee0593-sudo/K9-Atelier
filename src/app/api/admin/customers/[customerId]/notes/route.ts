import { NextResponse } from "next/server";
import {
  getStaffCustomerAdminNotes,
  saveStaffCustomerAdminNotes,
} from "@/lib/profiles/admin-notes";
import {
  ProfileValidationError,
  validateCustomerAdminNotes,
  validateCustomerId,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);
    const result = await getStaffCustomerAdminNotes(customerId);
    if ("error" in result) return mapStaffServiceError(result.error);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("GET /api/admin/customers/[customerId]/notes failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const notes = validateCustomerAdminNotes(body);
    const result = await saveStaffCustomerAdminNotes(customerId, notes);
    if ("error" in result) return mapStaffServiceError(result.error);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("PUT /api/admin/customers/[customerId]/notes failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
