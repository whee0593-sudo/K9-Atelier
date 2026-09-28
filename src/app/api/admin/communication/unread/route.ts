import { NextResponse } from "next/server";
import { getCommunicationBadgeCount } from "@/lib/communication/store";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { getStaffSession } from "@/lib/staff/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStaffSession();
  if ("error" in session) return mapStaffServiceError(session.error);
  const count = await getCommunicationBadgeCount();
  return NextResponse.json({ count });
}
