import { NextResponse } from "next/server";
import { handlePetRouteError, jsonError } from "@/lib/pets/errors";
import { isServiceError } from "@/lib/pets/result";
import { createPet, listPets } from "@/lib/pets/service";
import { validateCreatePetInput } from "@/lib/pets/validation";

export async function GET() {
  try {
    const result = await listPets();
    if (isServiceError(result)) {
      if (result.error === "unauthenticated") {
        return jsonError("Authentication required.", 401);
      }
      return jsonError("Something went wrong. Please try again.", 500);
    }
    return NextResponse.json({ pets: result.pets });
  } catch (error) {
    return handlePetRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const input = validateCreatePetInput(body);
    const result = await createPet(input);

    if (isServiceError(result)) {
      if (result.error === "unauthenticated") {
        return jsonError("Authentication required.", 401);
      }
      if (result.error === "conflict") {
        return jsonError("Could not save this pet profile.", 409);
      }
      return jsonError("Something went wrong. Please try again.", 500);
    }

    return NextResponse.json({ pet: result.pet }, { status: 201 });
  } catch (error) {
    return handlePetRouteError(error);
  }
}
