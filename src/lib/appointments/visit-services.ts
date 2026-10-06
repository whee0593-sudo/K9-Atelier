import { loadOccupiedStops } from "@/lib/appointments/schedule";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { compactVisitChildStarts } from "@/lib/visits/compact";
import {
  scheduleActivePetsFromVisitArrival,
  visitArrivalFits,
} from "@/lib/visits/visit";
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
        | "slot_unavailable"
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
      "id, customer_id, visit_id, service_id, service_name, add_on_options, appointment_date, pets ( weight_lbs ), profiles ( first_name, last_name, phone )",
    )
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error) {
    console.error("updateAppointmentVisitServices load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };

  const fields = appointmentFieldsFromVisitLineItems(lineItems);
  const pet = firstRelation<{ weight_lbs?: number | null }>(row.pets);
  const durationMinutes = estimateServiceDurationMinutes(
    fields.serviceId || (row.service_id as string),
    pet?.weight_lbs ?? 20,
    fields.addOnIds,
  );
  if (row.visit_id) {
    const fits = await visitServiceChangeFits({
      visitId: row.visit_id as string,
      appointmentId: row.id as string,
      appointmentDate: row.appointment_date as string,
      durationMinutes,
    });
    if ("error" in fits) return fits;
  }
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
      estimated_duration_minutes: durationMinutes,
    })
    .eq("id", row.id);

  if (saveError) {
    console.error("updateAppointmentVisitServices save failed:", saveError.message);
    return { error: "server" };
  }

  if (row.visit_id) {
    const { error: visitFeeError } = await admin
      .from("visits")
      .update({ travel_fee: fields.travelFee })
      .eq("id", row.visit_id);
    if (visitFeeError) {
      console.error(
        "updateAppointmentVisitServices visit travel fee failed:",
        visitFeeError.message,
      );
    }
    await compactVisitChildStarts(row.visit_id as string);
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

async function visitServiceChangeFits(input: {
  visitId: string;
  appointmentId: string;
  appointmentDate: string;
  durationMinutes: number;
}): Promise<{ ok: true } | { error: "server" | "slot_unavailable" }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select("id, status, scheduled_start, estimated_duration_minutes")
    .eq("visit_id", input.visitId);
  if (error) {
    console.error("visitServiceChangeFits load failed:", error.message);
    return { error: "server" };
  }
  const pets = (data ?? []).map((row) => ({
    id: row.id as string,
    status: row.status as "pending_confirmation" | "confirmed" | "cancelled",
    scheduledStart:
      typeof row.scheduled_start === "number" ? row.scheduled_start : null,
    estimatedDurationMinutes:
      row.id === input.appointmentId
        ? input.durationMinutes
        : typeof row.estimated_duration_minutes === "number" &&
            row.estimated_duration_minutes > 0
          ? row.estimated_duration_minutes
          : 60,
  }));
  const plan = scheduleActivePetsFromVisitArrival(pets);
  if (!plan || plan.slots.length === 0) return { ok: true };
  const occupied = await loadOccupiedStops(input.appointmentDate, {
    excludeAppointmentIds: pets.map((row) => row.id),
  });
  if ("error" in occupied) return { error: "server" };
  if (
    !visitArrivalFits({
      visitStartMinutes: plan.visitStartMinutes,
      durations: plan.slots.map((slot) => slot.durationMinutes),
      otherStops: occupied.stops,
    })
  ) {
    return { error: "slot_unavailable" };
  }
  return { ok: true };
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
