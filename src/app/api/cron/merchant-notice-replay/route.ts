import { NextResponse } from "next/server";
import {
  factsFromAppointments,
  loadVisitAppointments,
  replayDeferredMerchantAlerts,
} from "@/lib/communications/merchant-notices";

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
 * Accepted, in-flight, and uncertain rows are not sent again.
 * A pets-changed alert stays queued for a person to review.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await replayDeferredMerchantAlerts({
      loadVisit: async (visitId) => {
        const appointments = await loadVisitAppointments(visitId);
        if (!appointments) return null;
        return factsFromAppointments(appointments);
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("merchant notice replay failed:", error);
    return NextResponse.json({ error: "merchant_replay_failed" }, { status: 500 });
  }
}
