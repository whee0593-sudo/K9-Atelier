import { NextResponse } from "next/server";
import { handlePetRouteError, jsonError } from "@/lib/pets/errors";
import { validatePetId } from "@/lib/pets/validation";
import { createOwnVaccinationFileSignedUrl } from "@/lib/vaccinations/service";

type RouteContext = {
  params: Promise<{ petId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { petId: rawPetId } = await context.params;
    const petId = validatePetId(rawPetId);
    const result = await createOwnVaccinationFileSignedUrl(petId);

    if ("error" in result) {
      if (result.error === "unauthenticated") {
        return jsonError("Authentication required.", 401);
      }
      if (result.error === "not_found") {
        return jsonError("Rabies record not found.", 404);
      }
      return jsonError("Could not open this rabies record.", 500);
    }

    return NextResponse.json(result);
  } catch (error) {
    return handlePetRouteError(error);
  }
}
