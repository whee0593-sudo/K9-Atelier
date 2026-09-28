import { NextResponse } from "next/server";
import { isValidTwilioSignature } from "@/lib/sms/twilio-signature";

export function twilioPublicUrl(request: Request) {
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function readSignedTwilioForm(request: Request): Promise<
  | { params: Record<string, string> }
  | { response: NextResponse }
> {
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
      url: twilioPublicUrl(request),
      params,
    })
  ) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { params };
}
