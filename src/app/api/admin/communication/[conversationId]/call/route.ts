import { NextResponse } from "next/server";
import { startCommunicationCallback } from "@/lib/communication/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const result = await startCommunicationCallback(conversationId);
  if ("error" in result) {
    if (result.error === "conflict") {
      return staffJsonError(
        "This number cannot be called right now.",
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
  return NextResponse.json(result);
}
