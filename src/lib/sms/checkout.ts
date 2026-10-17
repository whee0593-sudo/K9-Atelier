import { createAdminClient } from "@/lib/supabase/admin";
import { deliverVisitLogisticsSms } from "@/lib/communications/visit-sms";
import { createSupabaseClaimStore } from "@/lib/communications/supabase-store";
import { sendTrackedSms } from "@/lib/communications/provider";
import { joinPetNames } from "@/lib/communications/visit-readiness";
import type { VisitDogFact } from "@/lib/communications/visit-readiness";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { buildCheckoutReadySms } from "@/lib/sms/checkout-copy";

function firstRelation<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

type CheckoutDogRow = {
  id: string;
  customer_id?: string | null;
  pet_id?: string | null;
  status: string;
  service_ended_at: string | null;
  pets?: { name: string | null; sex?: string | null } | { name: string | null; sex?: string | null }[] | null;
};

function checkoutBody(dogs: Array<{ petName: string | null; sex: string | null }>) {
  if (dogs.length === 1) {
    return buildCheckoutReadySms({
      petName: dogs[0]?.petName,
      sex: dogs[0]?.sex,
    });
  }
  const label = joinPetNames(dogs.map((dog) => dog.petName));
  return [
    `K9 ATELIER: ${label} are ready to come home! We’ll bring them to your door shortly. Thank you for trusting us with their care!`,
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}

export async function sendCheckoutReadySms(appointmentId: string) {
  if (!isSmsConfigured()) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select("id, customer_id, visit_id, pets ( name, sex ), profiles ( first_name, last_name, phone )")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("sendCheckoutReadySms lookup failed:", error.message);
    return false;
  }
  if (!data?.visit_id) return false;

  const visit = await admin
    .from("appointments")
    .select("id, customer_id, pet_id, status, service_ended_at, pets ( name, sex )")
    .eq("visit_id", data.visit_id)
    .neq("status", "cancelled");
  if (visit.error) {
    console.error("sendCheckoutReadySms visit lookup failed:", visit.error.message);
    return false;
  }

  const rows = (visit.data ?? []) as unknown as CheckoutDogRow[];
  const described = rows.map((row) => {
    const pet = firstRelation<{ name: string | null; sex: string | null }>(row.pets);
    return {
      appointmentId: row.id,
      petId: row.pet_id ?? "",
      status: row.status,
      serviceEndedAt: row.service_ended_at,
      petName: pet?.name ?? null,
      sex: pet?.sex ?? null,
    };
  });
  const dogs: VisitDogFact[] = described.map((dog) => ({
    appointmentId: dog.appointmentId,
    status: dog.status,
    serviceEndedAt: dog.serviceEndedAt,
    petName: dog.petName,
  }));

  const profile = firstRelation<{
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  }>(data.profiles);
  const to = normalizePhoneToE164(profile?.phone ?? "");
  if (!to) return false;

  const body = checkoutBody(described);
  const outcome = await deliverVisitLogisticsSms({
    event: "checkout_ready",
    visitId: data.visit_id as string,
    dogs,
    customerId: (data.customer_id as string | null) ?? null,
    petIds: described.map((dog) => dog.petId).filter(Boolean),
    recipient: to,
    body,
    store: createSupabaseClaimStore(admin),
    send: async () => {
      const result = await sendTrackedSms({ to, body });
      if (result.outcome === "skipped") {
        return { outcome: "failed" as const, error: "missing_config" };
      }
      if (result.outcome === "accepted") {
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
          petNames: described.map((dog) => dog.petName?.trim() || "your pet"),
        });
      }
      return result;
    },
  });

  if (outcome === "wait" || outcome === "empty") return false;
  return outcome === "accepted" || outcome === "duplicate" || outcome === "already_sent";
}
