import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { sanitizeLineItems } from "@/lib/charges/line-items";
import { sumLineItems } from "@/lib/charges/money";
import {
  appointmentFieldsFromVisitLineItems,
  mergeVisitLineItemsIntoOptions,
} from "@/lib/charges/visit-line-items";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { buildVisitServicesUpdatedSms } from "@/lib/sms/visit-update-copy";
import type { ChargeLineItem } from "@/lib/charges/types";

export async function updateAppointmentVisitServices(input: {
  appointmentId: string;
  lineItems: unknown;
}): Promise<
  | {
      ok: true;
      lineItems: ChargeLineItem[];
      estimatedTotal: number;
      serviceName: string;
      smsSent: boolean;
    }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "invalid"
        | "server";
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;

  const lineItems = sanitizeLineItems(input.lineItems);
  if (!lineItems) return { error: "invalid" };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointments")
    .select(
      "id, customer_id, service_id, service_name, add_on_options, profiles ( first_name, last_name, phone )",
    )
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error) {
    console.error("updateAppointmentVisitServices load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };

  const fields = appointmentFieldsFromVisitLineItems(lineItems);
  const nextOptions = mergeVisitLineItemsIntoOptions(
    (row.add_on_options as Record<string, unknown> | null) ?? {},
    lineItems,
  );

  const { error: saveError } = await admin
    .from("appointments")
    .update({
      service_id: fields.serviceId || row.service_id,
      service_name: fields.serviceName || row.service_name,
      add_on_ids: fields.addOnIds,
      add_on_options: nextOptions,
      travel_fee: fields.travelFee,
      estimated_total: fields.estimatedTotal,
    })
    .eq("id", row.id);

  if (saveError) {
    console.error("updateAppointmentVisitServices save failed:", saveError.message);
    return { error: "server" };
  }

  const smsSent = await sendVisitServicesUpdatedSms({
    customerId: row.customer_id as string,
    profile: firstRelation<{
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
    }>(row.profiles),
    lineItems,
    estimatedTotal: fields.estimatedTotal,
  });

  return {
    ok: true,
    lineItems,
    estimatedTotal: fields.estimatedTotal,
    serviceName: fields.serviceName,
    smsSent,
  };
}

function firstRelation<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

async function sendVisitServicesUpdatedSms(input: {
  customerId: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  lineItems: ChargeLineItem[];
  estimatedTotal: number;
}) {
  if (!isSmsConfigured()) return false;
  const to = normalizePhoneToE164(input.profile?.phone ?? "");
  if (!to) return false;
  const body = buildVisitServicesUpdatedSms({
    services: input.lineItems,
    estimatedTotal: input.estimatedTotal,
  });
  try {
    const sent = await sendSms({ to, body });
    if (!sent) return false;
    const customerName = [input.profile?.first_name, input.profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    await recordCustomerSms({
      direction: "outbound",
      phone: to,
      body,
      customerId: input.customerId,
      customerName: customerName || null,
      petNames: [],
    });
    return true;
  } catch (error) {
    console.error("sendVisitServicesUpdatedSms failed:", error);
    return false;
  }
}

export function visitServicesEstimatedTotal(items: ChargeLineItem[]) {
  return Math.round(sumLineItems(items) * 100) / 100;
}
