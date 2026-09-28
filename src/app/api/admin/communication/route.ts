import { NextResponse } from "next/server";
import { getCommunicationBadgeCount } from "@/lib/communication/store";
import { listStaffCommunication } from "@/lib/communication/service";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listStaffCommunication();
  if ("error" in result) return mapStaffServiceError(result.error);
  const badge = await getCommunicationBadgeCount();
  return NextResponse.json({
    rows: result.rows,
    unavailable: result.unavailable,
    badge,
  });
}
