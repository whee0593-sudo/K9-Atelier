import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  STAFF_SMS_MAX_CHARS,
  type StaffSmsRecipient,
  buildStaffCustomerSms,
} from "@/lib/sms/staff-compose-copy";
import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

export { STAFF_SMS_MAX_CHARS, buildStaffCustomerSms };
export type { StaffSmsRecipient };

function displayName(first: string | null, last: string | null, email: string) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email;
}

export async function listStaffSmsRecipients(): Promise<
  | { recipients: StaffSmsRecipient[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, phone")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("listStaffSmsRecipients failed:", error.message);
    return { error: "server" };
  }

  const recipients = (data ?? []).map((row) => {
    const phone = row.phone?.trim() ?? "";
    return {
      id: row.id as string,
      name: displayName(row.first_name, row.last_name, row.email),
      email: row.email as string,
      phone,
      canText: normalizePhoneToE164(phone) != null,
    };
  });

  recipients.sort((a, b) => Number(b.canText) - Number(a.canText) || a.name.localeCompare(b.name));
  return { recipients };
}

export async function sendStaffCustomerSms(input: {
  customerId: string;
  message: string;
}): Promise<
  | { ok: true; customerName: string; phone: string }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "no_phone"
        | "invalid"
        | "misconfigured"
        | "server";
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const customerId = input.customerId.trim();
  const message = input.message.trim();
  if (!customerId || !message || message.length > STAFF_SMS_MAX_CHARS) {
    return { error: "invalid" };
  }

  if (!isSmsConfigured()) return { error: "misconfigured" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, phone")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    console.error("sendStaffCustomerSms lookup failed:", error.message);
    return { error: "server" };
  }
  if (!data) return { error: "not_found" };

  const to = normalizePhoneToE164(data.phone ?? "");
  if (!to) return { error: "no_phone" };

  try {
    const sent = await sendSms({
      to,
      body: buildStaffCustomerSms(message),
    });
    if (!sent) return { error: "server" };
    const customer = await lookupCustomerByPhone(to);
    await recordCustomerSms({
      direction: "outbound",
      phone: to,
      body: message,
      customer: customer ?? {
        customerId: data.id as string,
        firstName: displayName(data.first_name, data.last_name, data.email).split(
          /\s+/,
        )[0],
        name: displayName(data.first_name, data.last_name, data.email),
        phone: to,
        petNames: [],
      },
    });
  } catch (error) {
    console.error("sendStaffCustomerSms failed:", error);
    return { error: "server" };
  }

  return {
    ok: true,
    customerName: displayName(data.first_name, data.last_name, data.email),
    phone: to,
  };
}
