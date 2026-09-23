import { NextResponse } from "next/server";
import { sendThreeWeekRebookReminders } from "@/lib/email/rebook-reminders";
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

  const sms = await sendThreeDayConfirmRequestSms();
  const rebook = await sendThreeWeekRebookReminders();
  return NextResponse.json({ sms, rebook });
}
