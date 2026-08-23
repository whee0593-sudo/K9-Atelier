import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import type { CustomerByPhone } from "@/lib/sms/customer-by-phone";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  buildStudioIntroSms,
  type StudioUnknownCaller,
} from "@/lib/sms/staff-compose-copy";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

export type { StudioUnknownCaller };

export async function recordStudioInboundCall(input: {
  phone: string;
  customer?: CustomerByPhone | null;
}) {
  if (!hasSupabaseAdminConfig()) return;
  const phone = normalizePhoneToE164(input.phone);
  if (!phone) return;

  const admin = createAdminClient();
  const { error } = await admin.from("studio_inbound_calls").insert({
    phone,
    customer_id: input.customer?.customerId ?? null,
  });

  if (error) {
    console.error("recordStudioInboundCall failed:", error.message);
  }
}

export async function listUnknownStudioCallers(): Promise<
  | { callers: StudioUnknownCaller[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!hasSupabaseAdminConfig()) return { callers: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("studio_inbound_calls")
    .select("phone, called_at, intro_sms_sent_at, customer_id")
    .is("customer_id", null)
    .order("called_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("listUnknownStudioCallers failed:", error.message);
    return { callers: [] };
  }

  const seen = new Set<string>();
  const callers: StudioUnknownCaller[] = [];
  for (const row of data ?? []) {
    const phone = row.phone as string;
    if (seen.has(phone)) continue;
    seen.add(phone);
    callers.push({
      phone,
      calledAt: row.called_at as string,
      introSentAt: (row.intro_sms_sent_at as string | null) ?? null,
    });
  }
  return { callers };
}

export async function sendStudioIntroSms(input: {
  phone: string;
}): Promise<
  | { ok: true; phone: string }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "invalid"
        | "misconfigured"
        | "server";
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const to = normalizePhoneToE164(input.phone);
  if (!to) return { error: "invalid" };
  if (!isSmsConfigured()) return { error: "misconfigured" };

  const body = buildStudioIntroSms();
  try {
    const sent = await sendSms({ to, body });
    if (!sent) return { error: "server" };
  } catch (error) {
    console.error("sendStudioIntroSms failed:", error);
    return { error: "server" };
  }

  await recordCustomerSms({
    direction: "outbound",
    phone: to,
    body,
    customerName: "Unknown caller",
  });

  if (hasSupabaseAdminConfig()) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("studio_inbound_calls")
      .update({ intro_sms_sent_at: new Date().toISOString() })
      .eq("phone", to)
      .is("intro_sms_sent_at", null);
    if (error) {
      console.error("sendStudioIntroSms mark failed:", error.message);
    }
  }

  return { ok: true, phone: to };
}
