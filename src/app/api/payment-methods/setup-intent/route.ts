import { NextResponse } from "next/server";
import { createSetupIntent } from "@/lib/payments/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export async function POST() {
  const result = await createSetupIntent();
  if ("error" in result) {
    if (result.error === "unauthenticated") {
      return mapStaffServiceError("unauthenticated");
    }
    if (result.error === "misconfigured") {
      return staffJsonError(
        "Card setup is not available yet. Please contact the Atelier.",
        503,
      );
    }
    return mapStaffServiceError("server");
  }

  return NextResponse.json(result);
}
