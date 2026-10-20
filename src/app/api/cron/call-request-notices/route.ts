import { callJson, callRequestsConfigured } from "@/lib/call-requests/server";
import { replayCallRequestNotices } from "@/lib/call-requests/notices";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return callJson({ error: "Unauthorized" }, 401);
  if (!callRequestsConfigured()) return callJson({ skipped: true });
  try { return callJson(await replayCallRequestNotices()); }
  catch { return callJson({ error: "Call request notices could not be checked." }, 503); }
}
