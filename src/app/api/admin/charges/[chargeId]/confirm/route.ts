import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { confirmAppointmentCharge } from "@/lib/charges/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ chargeId: string }> },
) {
  const { chargeId } = await context.params;
  let body: { paymentIntentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }
  if (!body.paymentIntentId) {
    return staffJsonError("Missing payment confirmation.", 400);
  }

  const result = await confirmAppointmentCharge(chargeId, body.paymentIntentId);
  if ("error" in result) return mapStaffServiceError(result.error);
  return NextResponse.json(result);
}
