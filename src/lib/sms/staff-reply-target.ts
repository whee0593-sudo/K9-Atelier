import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { getStaffVoicePhone } from "@/lib/voice/config";

export type StaffReplyTarget = {
  phone: string;
  customerName: string | null;
  petNames: string[];
};

export async function rememberStaffReplyTarget(input: {
  customerPhone: string;
  customerName?: string | null;
  petNames?: string[];
}) {
  const staffPhone = getStaffVoicePhone();
  const customerPhone = normalizePhoneToE164(input.customerPhone);
  if (!staffPhone || !customerPhone || !hasSupabaseAdminConfig()) return;

  const admin = createAdminClient();
  const { error } = await admin.from("staff_sms_reply_targets").upsert(
    {
      staff_phone: staffPhone,
      customer_phone: customerPhone,
      customer_name: input.customerName?.trim() || null,
      pet_names: (input.petNames ?? []).filter(Boolean).join(", ") || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "staff_phone" },
  );

  if (error) {
    console.error("rememberStaffReplyTarget failed:", error.message);
  }
}

export async function readStaffReplyTarget(): Promise<StaffReplyTarget | null> {
  const staffPhone = getStaffVoicePhone();
  if (!staffPhone || !hasSupabaseAdminConfig()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_sms_reply_targets")
    .select("customer_phone, customer_name, pet_names")
    .eq("staff_phone", staffPhone)
    .maybeSingle();

  if (error) {
    console.error("readStaffReplyTarget failed:", error.message);
    return null;
  }
  if (!data?.customer_phone) return null;

  return {
    phone: data.customer_phone as string,
    customerName: (data.customer_name as string | null)?.trim() || null,
    petNames:
      String(data.pet_names ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
  };
}
