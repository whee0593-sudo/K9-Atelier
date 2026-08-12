import { NextResponse } from "next/server";
import { handlePetRouteError, jsonError } from "@/lib/pets/errors";
import { isServiceError } from "@/lib/pets/result";
import { archivePet, updatePet } from "@/lib/pets/service";
import { validatePetId, validateUpdatePetInput } from "@/lib/pets/validation";

type RouteContext = {
  params: Promise<{ petId: string }>;
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

    const input = validateUpdatePetInput(body);
    const result = await updatePet(petId, input);

    if (isServiceError(result)) {
      if (result.error === "unauthenticated") {
        return jsonError("Authentication required.", 401);
      }
      if (result.error === "not_found") {
        return jsonError("Pet not found.", 404);
      }
      if (result.error === "conflict") {
        return jsonError("Could not update this pet profile.", 409);
      }
      return jsonError("Something went wrong. Please try again.", 500);
    }

    return NextResponse.json({ pet: result.pet });
  } catch (error) {
    return handlePetRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { petId: rawPetId } = await context.params;
    const petId = validatePetId(rawPetId);

    const result = await archivePet(petId);

    if (isServiceError(result)) {
      if (result.error === "unauthenticated") {
        return jsonError("Authentication required.", 401);
      }
      if (result.error === "not_found") {
        return jsonError("Pet not found.", 404);
      }
      return jsonError("Something went wrong. Please try again.", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePetRouteError(error);
  }
}
