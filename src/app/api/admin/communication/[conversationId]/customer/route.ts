import { NextResponse } from "next/server";
import { createCommunicationCustomer } from "@/lib/communication/customers";
import { ProfileValidationError } from "@/lib/profiles/validation";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const body = await request.json().catch(() => null);
  try {
    const result = await createCommunicationCustomer({ conversationId, body });
    if ("error" in result) {
      if (result.error === "conflict" && result.message) {
        return staffJsonError(result.message, 409);
      }
      if (!result.error) return mapStaffServiceError("server");
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return staffJsonError(error.message, 400);
    }
    console.error("create communication customer failed:", error);
    return staffJsonError("Something went wrong. Please try again.", 500);
  }
}
