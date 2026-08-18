import { NextResponse } from "next/server";
import { updateStaffPet } from "@/lib/profiles/staff-service";
import { jsonError, handlePetRouteError } from "@/lib/pets/errors";
import { isServiceError } from "@/lib/pets/result";
import { validatePetId, validateUpdatePetInput } from "@/lib/pets/validation";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

type RouteContext = {
  params: Promise<{ customerId: string; petId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { petId: rawPetId } = await context.params;
    const petId = validatePetId(rawPetId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const record =
      body != null && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const adminServiceNotes =
      typeof record.adminServiceNotes === "string" ? record.adminServiceNotes : undefined;
    const { adminServiceNotes: _notes, ...petBody } = record;
    void _notes;
    const hasPetFields = Object.keys(petBody).length > 0;
    const input = hasPetFields ? validateUpdatePetInput(petBody) : {};

    if (!hasPetFields && adminServiceNotes === undefined) {
      return jsonError("No valid fields provided to update.", 400);
    }

    const result = await updateStaffPet(petId, input, adminServiceNotes);
    if (isServiceError(result)) {
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ pet: result.pet });
  } catch (error) {
    return handlePetRouteError(error);
  }
}
