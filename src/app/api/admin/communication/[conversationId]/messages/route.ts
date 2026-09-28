import { NextResponse } from "next/server";
import { sendStaffCommunicationMessage } from "@/lib/communication/service";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const result = await sendStaffCommunicationMessage(
    conversationId,
    body?.body ?? "",
  );
  if ("error" in result) {
    if (result.error === "conflict" && result.message) {
      return staffJsonError(result.message, 409);
    }
    if (!result.error) return mapStaffServiceError("server");
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ detail: result.detail });
}
