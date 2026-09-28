import { updateMessageStatus } from "@/lib/communication/store";
import { readSignedTwilioForm } from "@/lib/sms/twilio-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signed = await readSignedTwilioForm(request);
  if ("response" in signed) return signed.response;

  const sid = signed.params.MessageSid ?? "";
  const status = signed.params.MessageStatus ?? signed.params.SmsStatus ?? "";
  if (sid && status) {
    try {
      await updateMessageStatus(sid, status);
    } catch (error) {
      console.error("message status update failed:", error);
    }
  }

  return new Response("", { status: 204 });
}
