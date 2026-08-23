import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { sendChargeReceipt } from "@/lib/charges/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ chargeId: string }> },
) {
  const { chargeId } = await context.params;
  let body: { channel?: "sms" | "email" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }
  if (body.channel !== "sms" && body.channel !== "email") {
    return staffJsonError("Choose text or email.", 400);
  }

  const result = await sendChargeReceipt(chargeId, body.channel);
  if ("error" in result) {
    if (result.error === "server") {
      return staffJsonError(
        body.channel === "sms"
          ? "Could not send the text receipt. Check the mobile number."
          : "Could not send the email receipt.",
        500,
      );
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ ok: true });
}
