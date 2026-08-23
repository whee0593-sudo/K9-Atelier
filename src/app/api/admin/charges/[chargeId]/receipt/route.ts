import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { sendChargeReceipt } from "@/lib/charges/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ chargeId: string }> },
) {
  const { chargeId } = await context.params;
  let body: { channel?: "email" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }
  if (body.channel && body.channel !== "email") {
    return staffJsonError("Receipts are sent by email.", 400);
  }

  const result = await sendChargeReceipt(chargeId);
  if ("error" in result) {
    if (result.error === "server") {
      return staffJsonError(
        "Could not send the email receipt. Check the customer email.",
        500,
      );
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ ok: true });
}
