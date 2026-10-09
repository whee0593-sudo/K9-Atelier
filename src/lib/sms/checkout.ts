import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { buildCheckoutReadySms } from "@/lib/sms/checkout-copy";
import { loadVisitNoticePets } from "@/lib/visits/notification-context";
import { runVisitNotification } from "@/lib/visits/notification-ledger";
import { petsReadyForCheckout } from "@/lib/visits/notification-scope";

function firstRelation<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

export async function sendCheckoutReadySms(appointmentId: string) {
  if (!isSmsConfigured()) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, customer_id, visit_id, pets ( name, sex ), profiles ( first_name, last_name, phone )",
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
  const to = normalizePhoneToE164(profile?.phone ?? "");
  if (!to) return false;

  const visitId = (data.visit_id as string | null) ?? null;
  const siblings = visitId ? await loadVisitNoticePets(visitId) : null;
  const ready = siblings ? petsReadyForCheckout(siblings) : null;
  if (siblings && !ready) return false;
  const petNames = ready?.map((row) => row.petName);
  const petName = petNames?.[0] || pet?.name?.trim() || "your pet";
  const body = buildCheckoutReadySms({
    petName,
    sex: ready && ready.length > 1 ? null : pet?.sex,
    petNames,
  });

  try {
    const outcome = await runVisitNotification({
      visitId,
      event: "checkout_ready",
      send: () => sendSms({ to, body }),
    });
    if (outcome !== "sent") return outcome === "skipped";
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
      petNames: petNames?.length ? petNames : [petName],
    });
    return true;
  } catch (sendError) {
    console.error("sendCheckoutReadySms failed:", sendError);
    return false;
  }
}
