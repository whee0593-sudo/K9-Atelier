import { NextResponse } from "next/server";
import { backfillStaffSmsPhotos } from "@/lib/sms/backfill-photos";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export const runtime = "nodejs";

export async function POST() {
  const result = await backfillStaffSmsPhotos();
  if ("error" in result) {
    if (result.message) {
      return staffJsonError(
        result.message,
        result.error === "misconfigured" ? 500 : 400,
      );
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json(result);
}
