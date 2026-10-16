import { NextResponse } from "next/server";
import { replayDeferredMerchantAlerts } from "@/lib/communications/merchant-notices";
import { sendThreeWeekRebookReminders } from "@/lib/email/rebook-reminders";
import { sendNextDayFollowUp } from "@/lib/followup/send";
import { sendThreeDayConfirmRequestSms } from "@/lib/sms/reminders";

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

  const reminders = await sendThreeDayConfirmRequestSms();
  const followUp = await sendNextDayFollowUp();
  const rebook = await sendThreeWeekRebookReminders();
  let merchantReplay: { replayed: number; kept: number } | { error: string } = {
    replayed: 0,
    kept: 0,
  };
  try {
    merchantReplay = await replayDeferredMerchantAlerts();
  } catch (error) {
    console.error("appointment reminders merchant replay failed:", error);
    merchantReplay = { error: "merchant_replay_failed" };
  }
  return NextResponse.json({ reminders, followUp, rebook, merchantReplay });
}
