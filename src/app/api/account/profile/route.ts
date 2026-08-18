import { NextResponse } from "next/server";
import { getOwnProfile, updateOwnProfile } from "@/lib/profiles/service";
import {
  ProfileValidationError,
  validateProfileWriteInput,
} from "@/lib/profiles/validation";
import { jsonError } from "@/lib/pets/errors";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

export async function GET() {
  const result = await getOwnProfile();
  if ("error" in result) {
    return mapStaffServiceError(result.error === "not_found" ? "not_found" : result.error);
  }
  return NextResponse.json({ profile: result.profile });
}

export async function PATCH(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const input = validateProfileWriteInput(body);
    const result = await updateOwnProfile(input);
    if ("error" in result) {
      return mapStaffServiceError(
        result.error === "not_found" ? "not_found" : result.error,
      );
    }
    return NextResponse.json({ profile: result.profile });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return jsonError(error.message, 400, error.field);
    }
    console.error("PATCH /api/account/profile failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
