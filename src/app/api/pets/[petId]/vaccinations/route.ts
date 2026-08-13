import { NextResponse } from "next/server";
import { handlePetRouteError, jsonError } from "@/lib/pets/errors";
import { isServiceError } from "@/lib/pets/result";
import { validatePetId } from "@/lib/pets/validation";
import { uploadPetVaccination } from "@/lib/vaccinations/service";
import { VaccinationValidationError } from "@/lib/vaccinations/validation";

type RouteContext = {
  params: Promise<{ petId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { petId: rawPetId } = await context.params;
    const petId = validatePetId(rawPetId);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Invalid upload request.", 400);
    }

    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return jsonError("Choose a vaccination file to upload.", 400, "file");
    }

    const expirationRaw = formData.get("expirationDate");
    const expirationDate =
      typeof expirationRaw === "string" && expirationRaw.trim() !== ""
        ? expirationRaw.trim()
        : null;

    const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
    const result = await uploadPetVaccination(petId, {
      fileBuffer,
      originalFilename: fileValue.name,
      expirationDate,
    });

    if ("error" in result) {
      if (result.error === "unauthenticated") {
        return jsonError("Authentication required.", 401);
      }
      if (result.error === "not_found") {
        return jsonError("Pet not found.", 404);
      }
      if (result.error === "invalid_file") {
        return jsonError(
          "Unsupported file type. Upload PDF, JPG, PNG, WEBP, or HEIC.",
          400,
          "file",
        );
      }
      if (result.error === "misconfigured") {
        return jsonError(
          "Vaccination uploads are temporarily unavailable.",
          503,
        );
      }
      if (result.error === "invalid_key") {
        return jsonError(
          "Server API key is invalid. In .env.local use the Secret key (sb_secret_...) or Legacy service_role key — not the publishable key.",
          500,
        );
      }
      return jsonError("Could not upload this vaccination record.", 500);
    }

    return NextResponse.json({ pet: result.pet }, { status: 201 });
  } catch (error) {
    if (error instanceof VaccinationValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    return handlePetRouteError(error);
  }
}
