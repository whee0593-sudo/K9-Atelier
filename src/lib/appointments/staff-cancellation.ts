import { canStaffCancelAppointment } from "@/lib/appointments/staff-actions";
import {
  contactFromAdminAppointment,
  fetchAppointmentAdminRecord,
} from "@/lib/email/appointment-context";
import { sendAppointmentStatusEmails } from "@/lib/email/appointment-mails";
import {
  loadOpenPolicyChangeClaim,
  policyChangeOperationKey,
  previewCustomerPolicyFee,
  resolvePolicyPaymentMethod,
  settleCustomerPolicyFee,
  type SettleRow,
} from "@/lib/policy-fees/customer-settle";
import { resumeSavedAppointmentChange } from "@/lib/policy-fees/resume-change";
import { getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { compactVisitChildStarts } from "@/lib/visits/compact";

async function loadStaffCancellation(appointmentId: string) {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const appointment = await fetchAppointmentAdminRecord(appointmentId);
  if (!appointment) return { error: "not_found" as const };
  if (!canStaffCancelAppointment(appointment) || !appointment.visitId) {
    return { error: "conflict" as const };
  }

  const { data, error } = await createAdminClient()
    .from("appointments")
    .select("id, status, appointment_date, appointment_time, scheduled_start, time_preference, visit_sequence, payment_method_id, service_price, travel_fee, estimated_total, add_on_ids, add_on_options")
    .eq("visit_id", appointment.visitId)
    .eq("customer_id", appointment.customerId)
    .neq("status", "cancelled");
  if (error) throw error;
  const row = data.find((entry) => entry.id === appointmentId) as SettleRow | undefined;
  if (!row || row.status !== appointment.status) return { error: "conflict" as const };

  // The calendar action targets this appointment. Other pets keep their slots.
  const action = data.length > 1 ? "remove_dog" as const : "cancel" as const;
  const visitId = appointment.visitId;
  const rows = [row];
  const existing = await loadOpenPolicyChangeClaim(policyChangeOperationKey({ action, visitId, rows }));
  const pricing = existing
    ? { fee: existing.chargedAmount, needsPriceReview: false }
    : await previewCustomerPolicyFee({ action, visitId, rows });
  const contact = contactFromAdminAppointment(appointment);
  const method = pricing.fee > 0 && !existing
    ? await resolvePolicyPaymentMethod(appointment.customerId, row.payment_method_id ?? null)
    : null;

  return {
    appointment,
    action,
    visitId,
    rows,
    actorId: session.user.id,
    contact,
    quote: {
      ...pricing,
      locked: Boolean(existing),
      hasPaymentMethod: Boolean(method || existing),
      hasEmail: Boolean(contact?.email.trim()),
    },
  };
}

export async function quoteStaffCancellation(appointmentId: string) {
  const loaded = await loadStaffCancellation(appointmentId);
  if (loaded.error) return { error: loaded.error };
  return { quote: loaded.quote };
}

export async function cancelStaffAppointment(
  appointmentId: string,
  expectedPolicyFee: unknown,
  amount: unknown,
) {
  const loaded = await loadStaffCancellation(appointmentId);
  if (loaded.error) return { error: loaded.error };
  const { appointment, action, visitId, rows, actorId, contact, quote } = loaded;

  if (quote.needsPriceReview) return { error: "price_review_required" as const };
  if (expectedPolicyFee !== quote.fee) return { error: "fee_changed" as const };
  if (
    typeof amount !== "number" || !Number.isFinite(amount) ||
    amount < 0 || amount > quote.fee ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7 ||
    (amount > 0 && amount < 0.5) ||
    (quote.locked && amount !== quote.fee)
  ) {
    return { error: "invalid_fee" as const };
  }

  const payment = await settleCustomerPolicyFee({
    action,
    rows,
    visitId,
    customerId: appointment.customerId,
    customerEmail: contact?.email,
    expectedAmount: amount,
    staff: { actorId, collectCap: amount, expectedPolicyFee: quote.fee },
  });
  if ("error" in payment) return payment;
  if (!payment.performChange) return { ok: true as const };

  const resumed = await resumeSavedAppointmentChange({
    claimId: payment.claimId,
    loadLive: async (ids) => {
      const { data, error } = await createAdminClient()
        .from("appointments")
        .select("id, status, appointment_date, scheduled_start")
        .in("id", ids);
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        status: row.status,
        appointmentDate: row.appointment_date,
        scheduledStart: row.scheduled_start,
      }));
    },
    planReschedule: async () => ({ error: "server" }),
    afterWrite: async () => {
      if (action === "remove_dog") await compactVisitChildStarts(visitId);
      if (contact) {
        await sendAppointmentStatusEmails(
          { ...appointment, status: "cancelled" },
          contact,
          "cancelled",
          appointment.status,
        );
      }
    },
  });
  if (resumed.outcome === "applied") {
    return { ok: true as const };
  }
  return { error: "change_review" as const };
}
