import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import {
  lookupCustomerByPhone,
  type CustomerByPhone,
} from "@/lib/sms/customer-by-phone";
import { formatPetAndOwnerLabel } from "@/lib/sms/inbox-copy";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  buildStudioCallerSms,
  type StudioUnknownCaller,
} from "@/lib/sms/staff-compose-copy";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

export type { StudioUnknownCaller };

const CALLER_SMS_DEDUP_MS = 24 * 60 * 60 * 1000;

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
    .order("called_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("listUnknownStudioCallers failed:", error.message);
    return { callers: [] };
  }

  const customerIds = [
    ...new Set(
      (data ?? [])
        .map((row) => (row.customer_id as string | null) ?? "")
        .filter(Boolean),
    ),
  ];
  const labels = new Map<string, string>();
  if (customerIds.length > 0) {
    const [{ data: profiles }, { data: pets }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", customerIds),
      admin
        .from("pets")
        .select("customer_id, name")
        .in("customer_id", customerIds)
        .is("archived_at", null),
    ]);
    const petsByCustomer = new Map<string, string[]>();
    for (const pet of pets ?? []) {
      const id = pet.customer_id as string;
      const name = String(pet.name ?? "").trim();
      if (!name) continue;
      const list = petsByCustomer.get(id) ?? [];
      list.push(name);
      petsByCustomer.set(id, list);
    }
    for (const profile of profiles ?? []) {
      const first =
        String(profile.first_name ?? "").trim() ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
        String(profile.email ?? "").split("@")[0];
      labels.set(
        profile.id as string,
        formatPetAndOwnerLabel({
          firstName: first,
          petNames: petsByCustomer.get(profile.id as string) ?? [],
        }),
      );
    }
  }

  const seen = new Set<string>();
  const callers: StudioUnknownCaller[] = [];
  for (const row of data ?? []) {
    const phone = row.phone as string;
    if (seen.has(phone)) continue;
    seen.add(phone);
    const customerId = (row.customer_id as string | null) ?? "";
    callers.push({
      phone,
      calledAt: row.called_at as string,
      introSentAt: (row.intro_sms_sent_at as string | null) ?? null,
      label: customerId ? labels.get(customerId) : undefined,
    });
  }
  return { callers };
}

async function hasRecentStudioCallerSms(phone: string) {
  if (!hasSupabaseAdminConfig()) return false;
  const admin = createAdminClient();
  const since = new Date(Date.now() - CALLER_SMS_DEDUP_MS).toISOString();
  const { data, error } = await admin
    .from("studio_inbound_calls")
    .select("id")
    .eq("phone", phone)
    .not("intro_sms_sent_at", "is", null)
    .gte("intro_sms_sent_at", since)
    .limit(1);

  if (error) {
    console.error("hasRecentStudioCallerSms failed:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function deliverStudioCallerSms(input: {
  phone: string;
  customer?: CustomerByPhone | null;
  force?: boolean;
}): Promise<
  | { ok: true; phone: string; skipped?: boolean }
  | { error: "invalid" | "misconfigured" | "server" }
> {
  const to = normalizePhoneToE164(input.phone);
  if (!to) return { error: "invalid" };
  if (!isSmsConfigured()) return { error: "misconfigured" };

  if (!input.force && (await hasRecentStudioCallerSms(to))) {
    return { ok: true, phone: to, skipped: true };
  }

  const customer =
    input.customer !== undefined
      ? input.customer
      : await lookupCustomerByPhone(to);
  const body = buildStudioCallerSms(customer);

  try {
    const sent = await sendSms({ to, body });
    if (!sent) return { error: "server" };
  } catch (error) {
    console.error("deliverStudioCallerSms failed:", error);
    return { error: "server" };
  }

  await recordCustomerSms({
    direction: "outbound",
    phone: to,
    body,
    customer,
    customerName: customer?.name ?? "Unknown caller",
  });

  if (hasSupabaseAdminConfig()) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("studio_inbound_calls")
      .update({ intro_sms_sent_at: new Date().toISOString() })
      .eq("phone", to)
      .is("intro_sms_sent_at", null);
    if (error) {
      console.error("deliverStudioCallerSms mark failed:", error.message);
    }
  }

  return { ok: true, phone: to };
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

  const result = await deliverStudioCallerSms({
    phone: input.phone,
    force: true,
  });
  if ("error" in result) return result;
  return { ok: true, phone: result.phone };
}
