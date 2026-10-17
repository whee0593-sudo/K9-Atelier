import { NextResponse } from "next/server";
import { replayDeferredMerchantAlerts } from "@/lib/communications/merchant-notices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Replays merchant notices whose claim could not be saved.
 * Separate from the customer reminder cron so an hourly pass cannot
 * run the 10:00 customer jobs a second time.
 * uncertain rows are not sent again.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const merchantReplay = await replayDeferredMerchantAlerts();
    return NextResponse.json({ merchantReplay });
  } catch (error) {
    console.error("merchant notice replay failed:", error);
    return NextResponse.json({ error: "merchant_replay_failed" }, { status: 500 });
  }
}
