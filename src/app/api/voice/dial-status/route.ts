import { NextResponse } from "next/server";
import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { deliverStudioCallerSms } from "@/lib/sms/studio-callers";
import { isValidTwilioSignature } from "@/lib/sms/twilio-signature";
import { buildVoiceErrorTwiml } from "@/lib/voice/bridge";
import {
  isStaffCallingStudio,
  MISSED_CALL_FALLBACK_SAY,
  shouldSendMissedCallSms,
} from "@/lib/voice/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function publicRequestUrl(request: Request) {
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const form = await request.formData();
  const params = Object.fromEntries(
    [...form.entries()].map(([key, value]) => [key, String(value)]),
  );

  if (
    !authToken ||
    !isValidTwilioSignature({
      authToken,
      signature,
      url: publicRequestUrl(request),
      params,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = params.From ?? "";
  const status = params.DialCallStatus ?? "";

  if (!isStaffCallingStudio(from)) {
    const phone = normalizePhoneToE164(from) ?? from;
    const customer = await lookupCustomerByPhone(from);
    try {
      const result = await deliverStudioCallerSms({ phone, customer });
      if ("error" in result) {
        console.error("caller SMS failed:", result.error, phone);
      }
    } catch (error) {
      console.error("caller SMS failed:", error);
    }
  }

  if (shouldSendMissedCallSms(status)) {
    return twiml(buildVoiceErrorTwiml(MISSED_CALL_FALLBACK_SAY));
  }

  return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
}
