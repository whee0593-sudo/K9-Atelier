import { NextResponse } from "next/server";
import { createStaffPet } from "@/lib/profiles/staff-service";
import { jsonError, handlePetRouteError } from "@/lib/pets/errors";
import { isServiceError } from "@/lib/pets/result";
import { validateCreatePetInput } from "@/lib/pets/validation";
import { ProfileValidationError, validateCustomerId } from "@/lib/profiles/validation";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

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

    const input = validateCreatePetInput(body);
    const result = await createStaffPet(customerId, input);
    if (isServiceError(result)) {
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ pet: result.pet }, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    return handlePetRouteError(error);
  }
}
