import { NextResponse } from "next/server";
import { replayMerchantVisitConfirmed } from "@/lib/communications/merchant-visit";
import { createSupabaseClaimStore } from "@/lib/communications/supabase-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Replays merchant visit notices only when decideClaim allows another send.
 * Uncertain and accepted rows are left alone.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({
      retried: 0,
      held: 0,
      reason: "supabase_admin_missing",
    });
  }
  const result = await replayMerchantVisitConfirmed({
    store: createSupabaseClaimStore(createAdminClient()),
  });
  return NextResponse.json(result);
}
