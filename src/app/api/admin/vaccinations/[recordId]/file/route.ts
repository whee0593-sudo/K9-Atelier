import { NextResponse } from "next/server";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { createVaccinationFileSignedUrl } from "@/lib/vaccinations/staff-service";
import { validatePetId } from "@/lib/pets/validation";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { recordId: rawRecordId } = await context.params;
    const recordId = validatePetId(rawRecordId);

    const result = await createVaccinationFileSignedUrl(recordId);

    if ("error" in result) {
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json(result);
  } catch {
    return mapStaffServiceError("not_found");
  }
}
