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

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await replayDeferredMerchantAlerts({
    loadVisit: async (visitId) => {
      const appointments = await loadVisitAppointments(visitId);
      if (!appointments) return null;
      return factsFromAppointments(appointments);
    },
  });
  return NextResponse.json(result);
}
