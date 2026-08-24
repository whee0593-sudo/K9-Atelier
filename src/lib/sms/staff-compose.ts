import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  STAFF_SMS_MAX_CHARS,
  type StaffSmsRecipient,
  buildStaffCustomerSms,
  staffRecipientSortKey,
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

  const ids = (data ?? []).map((row) => row.id as string);
  const petsByCustomer = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: pets, error: petsError } = await admin
      .from("pets")
      .select("customer_id, name")
      .in("customer_id", ids)
      .is("archived_at", null)
      .order("name", { ascending: true });
    if (petsError) {
      console.error("listStaffSmsRecipients pets failed:", petsError.message);
    }
    for (const pet of pets ?? []) {
      const customerId = pet.customer_id as string;
      const name = String(pet.name ?? "").trim();
      if (!name) continue;
      const list = petsByCustomer.get(customerId) ?? [];
      list.push(name);
      petsByCustomer.set(customerId, list);
    }
  }

  const recipients = (data ?? []).map((row) => {
    const phone = row.phone?.trim() ?? "";
    const firstName = String(row.first_name ?? "").trim();
    const lastName = String(row.last_name ?? "").trim();
    return {
      id: row.id as string,
      firstName,
      lastName,
      name: displayName(row.first_name, row.last_name, row.email),
      email: row.email as string,
      phone,
      petNames: petsByCustomer.get(row.id as string) ?? [],
      canText: normalizePhoneToE164(phone) != null,
    };
  });

  recipients.sort((a, b) =>
    staffRecipientSortKey(a).localeCompare(staffRecipientSortKey(b), "en"),
  );
  return { recipients };
}

export async function sendStaffCustomerSms(input: {
  customerId?: string;
  phone?: string;
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

  const customerId = input.customerId?.trim() ?? "";
  const typedPhone = normalizePhoneToE164(input.phone ?? "");
  const message = input.message.trim();
  if ((!customerId && !typedPhone) || !message || message.length > STAFF_SMS_MAX_CHARS) {
    return { error: "invalid" };
  }

  if (!isSmsConfigured()) return { error: "misconfigured" };

  const admin = createAdminClient();
  let data: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null = null;

  if (customerId) {
    const { data: row, error } = await admin
      .from("profiles")
      .select("id, email, first_name, last_name, phone")
      .eq("id", customerId)
      .maybeSingle();

    if (error) {
      console.error("sendStaffCustomerSms lookup failed:", error.message);
      return { error: "server" };
    }
    if (!row) return { error: "not_found" };
    data = row as typeof data;
  }

  const to =
    typedPhone ??
    normalizePhoneToE164(data?.phone ?? "");
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
      customer:
        customer ??
        (data
          ? {
              customerId: data.id,
              firstName: displayName(
                data.first_name,
                data.last_name,
                data.email,
              ).split(/\s+/)[0],
              name: displayName(data.first_name, data.last_name, data.email),
              phone: to,
              petNames: [],
            }
          : null),
    });
  } catch (error) {
    console.error("sendStaffCustomerSms failed:", error);
    return { error: "server" };
  }

  return {
    ok: true,
    customerName: data
      ? displayName(data.first_name, data.last_name, data.email)
      : to,
    phone: to,
  };
}
