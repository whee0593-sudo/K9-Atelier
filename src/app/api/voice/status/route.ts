import { applyVoiceStatus } from "@/lib/communication/store";
import { parseDurationSeconds } from "@/lib/communication/present";
import { readSignedTwilioForm } from "@/lib/sms/twilio-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signed = await readSignedTwilioForm(request);
  if ("response" in signed) return signed.response;

  const leg = new URL(request.url).searchParams.get("leg") === "customer"
    ? "customer"
    : "parent";
  const callStatus = signed.params.CallStatus ?? "";
  if (callStatus) {
    try {
      await applyVoiceStatus({
        callSid: signed.params.CallSid ?? "",
        parentCallSid: signed.params.ParentCallSid ?? "",
        leg,
        callStatus,
        durationSeconds: parseDurationSeconds(signed.params.CallDuration),
      });
    } catch (error) {
      console.error("call status update failed:", error);
    }
  }

  return new Response("", { status: 204 });
}
