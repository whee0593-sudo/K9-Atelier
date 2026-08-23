import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { startStaffOutboundCall } from "@/lib/voice/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    appointmentId?: string;
    customerId?: string;
  } | null;

  const result = await startStaffOutboundCall({
    appointmentId: body?.appointmentId,
    customerId: body?.customerId,
  });

  if ("error" in result) {
    if (result.error === "conflict") {
      return staffJsonError(
        "This customer does not have a mobile number we can call.",
        409,
      );
    }
    if (result.error === "misconfigured") {
      return staffJsonError(
        "Studio calling is not configured yet. Add STAFF_VOICE_PHONE and Twilio Voice keys in Vercel.",
        500,
      );
    }
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json({ ok: true });
}
