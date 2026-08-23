import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { getCollectContext } from "@/lib/charges/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const { appointmentId } = await context.params;
  const result = await getCollectContext(appointmentId);
  if ("error" in result) {
    return mapStaffServiceError(result.error);
  }
  if (!result.context.stripeConfigured) {
    return staffJsonError("Card charging is not configured yet.", 503);
  }
  return NextResponse.json(result.context);
}
