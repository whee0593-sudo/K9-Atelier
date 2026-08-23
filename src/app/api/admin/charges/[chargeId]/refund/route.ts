import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { refundAppointmentCharge } from "@/lib/charges/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ chargeId: string }> },
) {
  const { chargeId } = await context.params;
  let body: { amount?: number };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }

  const result = await refundAppointmentCharge(chargeId, Number(body.amount ?? 0));
  if ("error" in result) {
    if (result.error === "conflict" && result.message) {
      return staffJsonError(result.message, 409);
    }
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json(result);
}
