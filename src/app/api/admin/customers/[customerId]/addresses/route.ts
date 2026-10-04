import { NextResponse } from "next/server";
import {
  addStaffCustomerServiceAddress,
  listStaffCustomerServiceAddresses,
  rewriteStaffCustomerServiceAddress,
} from "@/lib/profiles/staff-addresses";
import {
  ProfileValidationError,
  validateCustomerId,
  validateStaffAddressCreateInput,
  validateStaffAddressRewriteInput,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

function mapAddressWriteError(
  error:
    | "unauthenticated"
    | "forbidden"
    | "not_found"
    | "outside_area"
    | "conflict"
    | "server",
  message?: string,
) {
  if (error === "outside_area") {
    return staffJsonError(
      message ?? "That address is outside the service area.",
      400,
    );
  }
  if (error === "conflict") {
    return staffJsonError(
      message ?? "That service address is already on this customer file.",
      409,
    );
  }
  if (error === "not_found") {
    return staffJsonError(message ?? "Record not found.", 404);
  }
  return mapStaffServiceError(error);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { customerId: rawId } = await context.params;
    const customerId = validateCustomerId(rawId);
    const result = await listStaffCustomerServiceAddresses(customerId);
    if ("error" in result) return mapStaffServiceError(result.error);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("GET /api/admin/customers/.../addresses failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

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

    const address = validateStaffAddressCreateInput(body);
    const result = await addStaffCustomerServiceAddress(customerId, address);
    if ("error" in result) {
      return mapAddressWriteError(result.error, result.message);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("POST /api/admin/customers/.../addresses failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

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
      return mapAddressWriteError(result.error, result.message);
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
