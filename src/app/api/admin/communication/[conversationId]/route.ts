import { NextResponse } from "next/server";
import { readStaffCommunication } from "@/lib/communication/service";
import { mapStaffServiceError } from "@/lib/staff/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const result = await readStaffCommunication(conversationId);
  if ("error" in result) {
    if (!result.error) {
      return mapStaffServiceError("server");
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ detail: result.detail });
}
