import { NextResponse } from "next/server";
import { handlePetRouteError, jsonError } from "@/lib/pets/errors";
import { validatePetId } from "@/lib/pets/validation";
import { ProfileValidationError, validateCustomerId } from "@/lib/profiles/validation";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { uploadStaffPetVaccination } from "@/lib/vaccinations/service";
import { VaccinationValidationError } from "@/lib/vaccinations/validation";

type RouteContext = {
  params: Promise<{ customerId: string; petId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { customerId: rawId, petId: rawPetId } = await context.params;
    const customerId = validateCustomerId(rawId);
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
    const result = await uploadStaffPetVaccination(customerId, petId, {
      fileBuffer,
      originalFilename: fileValue.name,
      expirationDate,
    });

    if ("error" in result) {
      if (result.error === "invalid_file") {
        return jsonError(
          "Unsupported file type. Upload PDF, JPG, PNG, WEBP, or HEIC.",
          400,
          "file",
        );
      }
      if (result.error === "invalid_key") {
        return jsonError(
          "Server API key is invalid. In .env.local use the Secret key (sb_secret_...) or Legacy service_role key — not the publishable key.",
          500,
        );
      }
      if (result.error === "misconfigured") {
        return jsonError("Vaccination uploads are temporarily unavailable.", 503);
      }
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json({ pet: result.pet }, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    if (error instanceof VaccinationValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    return handlePetRouteError(error);
  }
}
