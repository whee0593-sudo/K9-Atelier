import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { listStaffSmsInbox } from "@/lib/sms/inbox";
import {
  listStaffSmsRecipients,
  sendStaffCustomerSms,
} from "@/lib/sms/staff-compose";

export const runtime = "nodejs";

export async function GET() {
  const result = await listStaffSmsRecipients();
  if ("error" in result) {
    return mapStaffServiceError(result.error);
  }
  const inbox = await listStaffSmsInbox();
  return NextResponse.json({
    recipients: result.recipients,
    inbox: "inbox" in inbox ? inbox.inbox : [],
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    customerId?: string;
    message?: string;
  } | null;

  const result = await sendStaffCustomerSms({
    customerId: body?.customerId?.trim() ?? "",
    message: body?.message ?? "",
  });

  if ("error" in result) {
    if (result.error === "invalid") {
      return staffJsonError("Enter a message of 1–1,200 characters.", 409);
    }
    if (result.error === "no_phone") {
      return staffJsonError(
        "This customer does not have a mobile number we can text.",
        409,
      );
    }
    if (result.error === "misconfigured") {
      return staffJsonError(
        "Texting is not configured yet. Add Twilio keys in Vercel.",
        500,
      );
    }
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json(result);
}
