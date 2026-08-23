import { NextResponse } from "next/server";
import { isValidTwilioSignature } from "@/lib/sms/twilio-signature";
import {
  buildConnectCustomerTwiml,
  buildVoiceErrorTwiml,
  readVoiceBridgeTarget,
} from "@/lib/voice/bridge";
import { getTwilioVoiceFromNumber } from "@/lib/voice/config";

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

  const requestUrl = new URL(request.url);
  const customerNumber = readVoiceBridgeTarget({
    to: requestUrl.searchParams.get("to") ?? undefined,
    exp: requestUrl.searchParams.get("exp") ?? undefined,
    sig: requestUrl.searchParams.get("sig") ?? undefined,
  });
  const callerId = getTwilioVoiceFromNumber();

  if (!customerNumber || !callerId) {
    return twiml(
      buildVoiceErrorTwiml(
        "This call link has expired. Please try again from the admin page.",
      ),
    );
  }

  return twiml(buildConnectCustomerTwiml(customerNumber, callerId));
}
