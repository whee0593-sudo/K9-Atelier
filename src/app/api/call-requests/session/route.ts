import { callJson, callRequestsConfigured, createCallSession, findCallSession, publicCallAction, publicCallState } from "@/lib/call-requests/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!callRequestsConfigured()) return callJson({ status: "unavailable" });
  try { return callJson(publicCallState(await findCallSession(request))); }
  catch { return callJson({ error: "Call requests are temporarily unavailable." }, 503); }
}
export async function POST(request: Request) {
  return publicCallAction(request, body => createCallSession(request, body.reset === true));
}
