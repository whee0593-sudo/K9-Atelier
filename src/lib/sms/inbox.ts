import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import {
  lookupCustomerByPhone,
  type CustomerByPhone,
} from "@/lib/sms/customer-by-phone";
import {
  buildStaffInboundForwardSms,
  type StaffSmsInboxItem,
} from "@/lib/sms/inbox-copy";
import { normalizePhoneToE164, phonesMatch } from "@/lib/sms/phone";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { getStaffVoicePhone } from "@/lib/voice/config";

export type { StaffSmsInboxItem };

export function isStaffPhone(from: string) {
  return phonesMatch(from, getStaffVoicePhone());
}

export async function recordCustomerSms(input: {
  direction: "inbound" | "outbound";
  phone: string;
  body: string;
  customer?: CustomerByPhone | null;
  customerId?: string | null;
  customerName?: string | null;
  petNames?: string[] | string | null;
}) {
  if (!hasSupabaseAdminConfig()) return;
  const body = input.body.trim();
  if (!body) return;

  const petNames = Array.isArray(input.petNames)
    ? input.petNames.filter(Boolean).join(", ")
    : (input.petNames ?? input.customer?.petNames.join(", ") ?? "");

  const admin = createAdminClient();
  const { error } = await admin.from("customer_sms_messages").insert({
    direction: input.direction,
    phone: normalizePhoneToE164(input.phone) ?? input.phone,
    body,
    customer_id: input.customer?.customerId ?? input.customerId ?? null,
    customer_name: input.customer?.name ?? input.customerName ?? null,
    pet_names: petNames || null,
  });

  if (error) {
    console.error("recordCustomerSms failed:", error.message);
  }
}

export async function forwardInboundSmsToStaff(input: {
  from: string;
  body: string;
  customer?: CustomerByPhone | null;
}) {
  const staffPhone = getStaffVoicePhone();
  if (!staffPhone || !isSmsConfigured()) return false;
  if (isStaffPhone(input.from)) return false;

  const customer = input.customer ?? (await lookupCustomerByPhone(input.from));
  return sendSms({
    to: staffPhone,
    body: buildStaffInboundForwardSms({
      firstName: customer?.firstName ?? "Unknown",
      petNames: customer?.petNames ?? [],
      body: input.body,
      phone: normalizePhoneToE164(input.from) ?? input.from,
    }),
  });
}

export async function listStaffSmsInbox(): Promise<
  | { inbox: StaffSmsInboxItem[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!hasSupabaseAdminConfig()) return { inbox: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customer_sms_messages")
    .select(
      "id, direction, phone, body, customer_name, pet_names, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("listStaffSmsInbox failed:", error.message);
    return { inbox: [] };
  }

  return {
    inbox: (data ?? []).map((row) => ({
      id: row.id as string,
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      customerName: (row.customer_name as string | null)?.trim() || "Unknown",
      petNames: (row.pet_names as string | null)?.trim() || "",
      phone: row.phone as string,
      body: row.body as string,
      createdAt: row.created_at as string,
    })),
  };
}
