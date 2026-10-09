import { buildCommunicationContext } from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { sendSms } from "@/lib/sms/twilio";
import { buildCheckoutReadySms } from "@/lib/sms/checkout-copy";

function firstRelation<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

export async function sendCheckoutReadySms(appointmentId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, customer_id, pet_id, visit_id, pets ( name, sex ), profiles ( first_name, last_name, phone )",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("sendCheckoutReadySms lookup failed:", error.message);
    return false;
  }
  if (!data) return false;

  const pet = firstRelation<{ name: string | null; sex: string | null }>(
    data.pets,
  );
  const profile = firstRelation<{
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  }>(data.profiles);
  const to = normalizePhoneToE164(profile?.phone ?? "") ?? "";
  const petName = pet?.name?.trim() || "your pet";
  const body = buildCheckoutReadySms({
    petName,
    sex: pet?.sex,
  });

  try {
    const result = await sendSms({
      to,
      body,
      communication: buildCommunicationContext({
        notificationType: "checkout_ready",
        recipient: to || profile?.phone || "missing",
        customerId: (data.customer_id as string | null) ?? null,
        visitId: (data.visit_id as string | null) ?? null,
        appointmentIds: [appointmentId],
        petIds: data.pet_id ? [data.pet_id as string] : [],
      }),
    });
    if (!isCommunicationAccepted(result)) return false;
    if (!to) return false;
    const customerName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    await recordCustomerSms({
      direction: "outbound",
      phone: to,
      body,
      customerId: (data.customer_id as string | null) ?? null,
      customerName: customerName || null,
      petNames: [petName],
    });
    return true;
  } catch (sendError) {
    console.error("sendCheckoutReadySms failed:", sendError);
    return false;
  }
}
