import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { setVaccinationVerificationStatus } from "@/lib/vaccinations/staff-service";
import { validatePetId } from "@/lib/pets/validation";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { recordId: rawRecordId } = await context.params;
    const recordId = validatePetId(rawRecordId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return staffJsonError("Invalid request body.", 400);
    }

    const status =
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      (body.status === "verified" || body.status === "rejected")
        ? body.status
        : null;

    if (!status) {
      return staffJsonError('Status must be "verified" or "rejected".', 400);
    }

    const result = await setVaccinationVerificationStatus(recordId, status);

    if ("error" in result) {
      return mapStaffServiceError(result.error);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return staffJsonError("Invalid record id.", 404);
  }
}
