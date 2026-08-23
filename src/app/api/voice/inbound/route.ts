import { NextResponse } from "next/server";
import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { isValidTwilioSignature } from "@/lib/sms/twilio-signature";
import { sendSms } from "@/lib/sms/twilio";
import {
  buildForwardCallTwiml,
  buildIncomingCallSms,
  buildWhisperSay,
  buildWhisperUrl,
  isStaffCallingStudio,
} from "@/lib/voice/inbound";
import { buildVoiceErrorTwiml } from "@/lib/voice/bridge";
import { getStaffVoicePhone } from "@/lib/voice/config";

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
  if (isStaffCallingStudio(from)) {
    return twiml(
      buildVoiceErrorTwiml("This is the K9 Atelier studio line."),
    );
  }

  const staffPhone = getStaffVoicePhone();
  if (!staffPhone) {
    return twiml(
      buildVoiceErrorTwiml(
        "We could not reach K9 Atelier. Please text this number or email penny@k9atelier.com.",
      ),
    );
  }

  const phone = normalizePhoneToE164(from) ?? from;
  const customer = await lookupCustomerByPhone(from);
  const caller = { phone, customer };
  const whisperUrl = buildWhisperUrl(buildWhisperSay(caller));

  void sendSms({
    to: staffPhone,
    body: buildIncomingCallSms(caller),
  }).catch((error: unknown) => {
    console.error("incoming call SMS failed:", error);
  });

  return twiml(buildForwardCallTwiml(staffPhone, whisperUrl));
}
