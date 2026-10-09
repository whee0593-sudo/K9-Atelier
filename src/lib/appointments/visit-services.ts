import { assertVisitScheduleAllowed } from "@/lib/appointments/schedule";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppointmentDuration } from "@/lib/visits/duration";
import { applyVisitServiceChange } from "@/lib/visits/persist";
import {
  hasVisitSequence,
  scheduleActivePetsFromVisitArrival,
} from "@/lib/visits/visit";
import { getStaffSession } from "@/lib/staff/auth";
import { sanitizeLineItems } from "@/lib/charges/line-items";
import { sumLineItems } from "@/lib/charges/money";
import {
  appointmentFieldsFromVisitLineItems,
  mergeVisitLineItemsIntoOptions,
} from "@/lib/charges/visit-line-items";
import {
  buildCommunicationContext,
  communicationFingerprint,
} from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { sendSms } from "@/lib/sms/twilio";
import { buildVisitServicesUpdatedSms } from "@/lib/sms/visit-update-copy";
import type { ChargeLineItem } from "@/lib/charges/types";
import type { AppointmentStatus } from "@/lib/appointments/types";

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
      "id, customer_id, pet_id, visit_id, status, service_id, service_name, add_on_options, appointment_date, service_ended_at, pets ( weight_lbs ), profiles ( first_name, last_name, phone )",
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
  const nextOptions = mergeVisitLineItemsIntoOptions(
    (row.add_on_options as Record<string, unknown> | null) ?? {},
    lineItems,
  );
  const service = {
    serviceId: fields.serviceId || (row.service_id as string),
    serviceName: fields.serviceName || (row.service_name as string),
    addOnIds: fields.addOnIds,
    addOnOptions: nextOptions,
    travelFee: fields.travelFee,
    estimatedTotal: fields.estimatedTotal,
    durationMinutes,
  };

  if (!row.visit_id) {
    const futureRow =
      (row.appointment_date as string) >= todayInBusinessTimezone() &&
      !row.service_ended_at &&
      row.status !== "cancelled";
    const { error: saveError } = await admin
      .from("appointments")
      .update({
        service_id: service.serviceId,
        service_name: service.serviceName,
        add_on_ids: service.addOnIds,
        add_on_options: service.addOnOptions,
        travel_fee: service.travelFee,
        estimated_total: service.estimatedTotal,
        ...(futureRow ? { estimated_duration_minutes: durationMinutes } : {}),
      })
      .eq("id", row.id);
    if (saveError) {
      console.error("updateAppointmentVisitServices save failed:", saveError.message);
      return { error: "server" };
    }
  } else {
    const planned = await planVisitServiceChange({
      visitId: row.visit_id as string,
      appointmentId: row.id as string,
      appointmentDate: row.appointment_date as string,
      status: row.status as AppointmentStatus,
      serviceEndedAt: (row.service_ended_at as string | null) ?? null,
      durationMinutes,
    });
    if ("error" in planned) return planned;
    const written = await applyVisitServiceChange({
      appointmentId: row.id as string,
      visitId: row.visit_id as string,
      service: {
        ...service,
        durationMinutes: planned.rewriteSchedule ? durationMinutes : null,
      },
      schedule: planned.schedule,
    });
    if ("error" in written) return written;
  }

  const smsSent = await sendVisitServicesUpdatedSms({
    customerId: row.customer_id as string,
    appointmentId: row.id as string,
    visitId: (row.visit_id as string | null) ?? null,
    petId: (row.pet_id as string | null) ?? null,
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

async function planVisitServiceChange(input: {
  visitId: string;
  appointmentId: string;
  appointmentDate: string;
  status: AppointmentStatus;
  serviceEndedAt: string | null;
  durationMinutes: number;
}): Promise<
  | {
      ok: true;
      rewriteSchedule: boolean;
      schedule: {
        serviceDate: string;
        visitStartMinutes: number;
        timePreference: "morning" | "afternoon" | null;
        children: Array<{
          id: string;
          scheduledStart: number;
          durationMinutes: number;
          appointmentTime: string | null;
          timePreference: "morning" | "afternoon" | null;
        }>;
      } | null;
    }
  | { error: "server" | "slot_unavailable" | "invalid" }
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, status, scheduled_start, estimated_duration_minutes, visit_sequence, appointment_date, service_ended_at, service_id, add_on_ids, time_preference, pets ( weight_lbs )",
    )
    .eq("visit_id", input.visitId)
    .order("visit_sequence", { ascending: true });
  if (error) {
    console.error("planVisitServiceChange load failed:", error.message);
    return { error: "server" };
  }

  const today = todayInBusinessTimezone();
  const rows = data ?? [];
  const active = rows.filter((row) => row.status !== "cancelled");
  const future =
    input.appointmentDate >= today &&
    (input.status === "confirmed" || input.status === "pending_confirmation") &&
    !input.serviceEndedAt &&
    active.every((row) => !row.service_ended_at);
  if (!future) {
    return { ok: true, rewriteSchedule: false, schedule: null };
  }

  const pets = rows.map((row) => {
    const weight = firstRelation<{ weight_lbs?: number | null }>(row.pets);
    const decision = resolveAppointmentDuration({
      storedMinutes: row.estimated_duration_minutes as number | null,
      status: row.status as AppointmentStatus,
      appointmentDate: row.appointment_date as string,
      serviceEndedAt: (row.service_ended_at as string | null) ?? null,
      liveEstimateMinutes: estimateServiceDurationMinutes(
        row.service_id as string,
        weight?.weight_lbs ?? 20,
        (row.add_on_ids as string[] | null) ?? [],
      ),
      today,
    });
    const editing = row.id === input.appointmentId;
    return {
      id: row.id as string,
      status: row.status as AppointmentStatus,
      scheduledStart:
        typeof row.scheduled_start === "number" ? row.scheduled_start : null,
      visitSequence:
        typeof row.visit_sequence === "number" ? row.visit_sequence : null,
      estimatedDurationMinutes: editing
        ? input.durationMinutes
        : (decision.minutes ?? 0),
      unknown: editing ? false : decision.unknown,
      timePreference: (row.time_preference ?? null) as
        | "morning" | "afternoon" | null,
    };
  });
  if (
    pets.some(
      (row) =>
        row.status !== "cancelled" &&
        (row.unknown || !hasVisitSequence(row.visitSequence)),
    )
  ) {
    return { error: "invalid" };
  }

  const plan = scheduleActivePetsFromVisitArrival(pets);
  if (!plan || plan.slots.length === 0) return { error: "slot_unavailable" };
  const allowed = await assertVisitScheduleAllowed({
    date: input.appointmentDate,
    visitStartMinutes: plan.visitStartMinutes,
    durations: plan.slots.map((slot) => slot.durationMinutes),
    excludeAppointmentIds: pets.map((row) => row.id),
  });
  if ("error" in allowed) {
    return {
      error: allowed.error === "slot_unavailable" ? "slot_unavailable" : "server",
    };
  }

  const preference = pets.find((row) => row.id === plan.slots[0]?.id)
    ?.timePreference ?? null;
  return {
    ok: true,
    rewriteSchedule: true,
    schedule: {
      serviceDate: input.appointmentDate,
      visitStartMinutes: plan.visitStartMinutes,
      timePreference: preference,
      children: plan.slots.map((slot) => ({
        id: slot.id,
        scheduledStart: slot.scheduledStart,
        durationMinutes: slot.durationMinutes,
        appointmentTime: slot.appointmentTime,
        timePreference: slot.usedPreference,
      })),
    },
  };
}

function firstRelation<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

async function sendVisitServicesUpdatedSms(input: {
  customerId: string;
  appointmentId: string;
  visitId: string | null;
  petId: string | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  lineItems: ChargeLineItem[];
  estimatedTotal: number;
}) {
  const to = normalizePhoneToE164(input.profile?.phone ?? "") ?? "";
  const body = buildVisitServicesUpdatedSms({
    services: input.lineItems,
    estimatedTotal: input.estimatedTotal,
  });
  try {
    const result = await sendSms({
      to,
      body,
      communication: buildCommunicationContext({
        notificationType: "visit_services_updated",
        recipient: to || input.profile?.phone || "missing",
        customerId: input.customerId,
        visitId: input.visitId,
        appointmentIds: [input.appointmentId],
        petIds: input.petId ? [input.petId] : [],
        fingerprint: communicationFingerprint(body),
      }),
    });
    if (!isCommunicationAccepted(result) || !to) return false;
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
