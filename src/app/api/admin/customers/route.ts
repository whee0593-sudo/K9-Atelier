import { NextResponse } from "next/server";
import { jsonError } from "@/lib/pets/errors";
import {
  createStaffCustomer,
  listStaffCustomers,
} from "@/lib/profiles/staff-service";
import {
  ProfileValidationError,
  validateStaffProfileWriteInput,
} from "@/lib/profiles/validation";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function GET() {
  const result = await listStaffCustomers();
  if ("error" in result) {
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({
    admins: result.admins,
    customers: result.customers,
  });
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const input = validateStaffProfileWriteInput(body);
    const result = await createStaffCustomer(input);
    if ("error" in result) {
      if (result.message) {
        return staffJsonError(
          result.message,
          result.error === "conflict" ? 409 : 500,
        );
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ customer: result.customer });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("POST /api/admin/customers failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
