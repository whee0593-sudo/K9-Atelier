import { randomUUID } from "crypto";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import { changeNoticeBand } from "@/lib/appointments/change-policy";
import { dollarsToCents } from "@/lib/charges/money";
import type { ChargeLineItem } from "@/lib/charges/types";
import { executePolicyFee } from "@/lib/policy-fees/execute";
import { policyFeeFromRows, type PolicyPriceRow } from "@/lib/policy-fees/coverage";
import {
  acquirePolicyFeeChange,
  beginPolicyFeeClaim,
  completePolicyFeeClaim,
  failPolicyFeeClaim,
  loadActiveCoverage,
  loadAuthorizedCap,
  loadAuthorizedReopen,
  loadPolicyFeeClaim,
  markPolicyFeeChangeApplied,
  markPolicyFeePaymentUnknown,
  priceWithCap,
  recordPolicyFeePayment,
  reservePolicyFeeStripeSubmit,
  visitHasUnreviewedLegacyPolicyCharge,
} from "@/lib/policy-fees/db";
import {
  policyFeeStripeMetadata,
  searchStripePolicyPayment,
} from "@/lib/policy-fees/stripe-lookup";
import {
  policyFeeForfeitsService,
  policyFeeIdempotencyKey,
  type PolicyFeeAction,
} from "@/lib/policy-fees/keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateStripeCustomerId } from "@/lib/payments/service";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";

type SettleRow = PolicyPriceRow & {
  id: string;
  appointment_date: string;
  scheduled_start?: number | null;
  payment_method_id?: string | null;
};

export type CustomerPolicySettlement =
  | {
      ok: true;
      fee: number;
      claimId: string;
      performChange: boolean;
      cardBrand?: string;
      cardLast4?: string;
    }
  | {
      error:
        | "payment_required"
        | "misconfigured"
        | "server"
        | "payment_failed"
        | "price_review_required"
        | "coverage_review_required"
        | "fee_changed"
        | "visit_busy"
        | "conflict"
        | "payment_pending"
        | "payment_unknown";
    };

function feeLabel(action: AppointmentChangeAction) {
  if (action === "reschedule") return "Late reschedule fee";
  if (action === "remove_dog") return "Removed dog fee";
  return "Cancellation fee";
}

function operationKey(input: {
  action: PolicyFeeAction;
  visitId: string;
  rows: SettleRow[];
  rescheduleTo?: { date: string; slotStartMinutes: number };
  reopenId?: string | null;
}) {
  const fromDate = [...input.rows].sort((a, b) =>
    a.appointment_date.localeCompare(b.appointment_date),
  )[0]?.appointment_date;
  const fromSlot = input.rows.reduce<number | null>((min, row) => {
    if (row.scheduled_start == null) return min;
    return min == null ? row.scheduled_start : Math.min(min, row.scheduled_start);
  }, null);
  return policyFeeIdempotencyKey({
    action: input.action,
    visitId: input.visitId,
    appointmentId: input.rows[0]?.id,
    fromDate,
    fromSlot,
    toDate: input.rescheduleTo?.date,
    toSlot: input.rescheduleTo?.slotStartMinutes,
    reopenId: input.reopenId,
  });
}

export async function previewCustomerPolicyFee(input: {
  action: AppointmentChangeAction;
  rows: SettleRow[];
  visitId: string | null;
  rescheduleTo?: { date: string; slotStartMinutes: number };
}) {
  if (input.action === "add_dog") {
    return { fee: 0, needsPriceReview: false, collectCap: null as number | null, waiver: 0 };
  }
  if (!input.visitId) {
    return { fee: 0, needsPriceReview: true, collectCap: null, waiver: 0 };
  }
  if (await visitHasUnreviewedLegacyPolicyCharge(input.visitId)) {
    return { fee: 0, needsPriceReview: true, collectCap: null, waiver: 0 };
  }
  const first = input.rows[0];
  const band = first
    ? changeNoticeBand(first.appointment_date, first.scheduled_start ?? null)
    : "complimentary";
  const priced = policyFeeFromRows({
    action: input.action,
    rows: input.rows,
    coverage: await loadActiveCoverage(input.visitId),
    band,
  });
  if (!priced.ok) {
    return { fee: 0, needsPriceReview: true, collectCap: null, waiver: 0 };
  }
  const key = operationKey({
    action: input.action,
    visitId: input.visitId,
    rows: input.rows,
    rescheduleTo: input.rescheduleTo,
  });
  const cap = await loadAuthorizedCap(key);
  const net = priceWithCap(priced.computed, cap);
  if (!net.ok) {
    return { fee: 0, needsPriceReview: true, collectCap: null, waiver: 0 };
  }
  return {
    fee: net.charged,
    needsPriceReview: false,
    collectCap: net.collectCap,
    waiver: net.waiver,
  };
}

async function resolvePaymentMethod(customerId: string, appointmentMethodId: string | null) {
  const admin = createAdminClient();
  const query = admin
    .from("payment_methods")
    .select("id, stripe_payment_method_id, brand, last4")
    .eq("customer_id", customerId);
  const { data } = appointmentMethodId
    ? await query.eq("id", appointmentMethodId).maybeSingle()
    : await query.order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (data?.id && data.stripe_payment_method_id) {
    return {
      id: data.id as string,
      stripePaymentMethodId: data.stripe_payment_method_id as string,
      brand: (data.brand as string | null) ?? undefined,
      last4: (data.last4 as string | null) ?? undefined,
    };
  }
  return null;
}

export async function settleCustomerPolicyFee(input: {
  action: AppointmentChangeAction;
  rows: SettleRow[];
  visitId: string | null | undefined;
  customerId: string;
  customerEmail?: string;
  expectedAmount?: number | null;
  rescheduleTo?: { date: string; slotStartMinutes: number };
}): Promise<CustomerPolicySettlement> {
  if (input.action === "add_dog") return { error: "conflict" };
  if (!input.visitId) return { error: "coverage_review_required" };
  if (input.rows.length === 0) return { error: "conflict" };
  if (await visitHasUnreviewedLegacyPolicyCharge(input.visitId)) {
    return { error: "coverage_review_required" };
  }
  const first = input.rows[0];
  const band = changeNoticeBand(first.appointment_date, first.scheduled_start ?? null);
  const coverage = await loadActiveCoverage(input.visitId);
  const priced = policyFeeFromRows({
    action: input.action,
    rows: input.rows,
    coverage,
    band,
  });
  if (!priced.ok) return { error: "price_review_required" };

  let key = operationKey({
    action: input.action,
    visitId: input.visitId,
    rows: input.rows,
    rescheduleTo: input.rescheduleTo,
  });
  const reopen = await loadAuthorizedReopen(input.visitId, input.action);
  if (reopen && key !== reopen.idempotencyKey) {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("policy_fee_claims")
      .select("status, appointment_change_applied")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (
      existing &&
      existing.status !== "failed" &&
      existing.appointment_change_applied
    ) {
      key = reopen.idempotencyKey;
    }
  }

  const cap = await loadAuthorizedCap(key);
  const net = priceWithCap(priced.computed, cap);
  if (!net.ok) return { error: "server" };

  let method =
    net.charged > 0
      ? await resolvePaymentMethod(input.customerId, first.payment_method_id ?? null)
      : null;
  let stripeCustomerId: string | null = null;
  if (net.charged > 0) {
    if (!method) return { error: "payment_required" };
    if (!getStripe() || !isStripeConfigured()) return { error: "misconfigured" };
    stripeCustomerId = await getOrCreateStripeCustomerId(
      input.customerId,
      input.customerEmail,
    );
    if (!stripeCustomerId) return { error: "server" };
  }

  let begun;
  try {
    begun = await beginPolicyFeeClaim({
      idempotencyKey: key,
      visitId: input.visitId,
      action: input.action,
      appointmentId: input.action === "remove_dog" ? first.id : first.id,
      affectedAppointmentIds: priced.affectedAppointmentIds,
      includesTravel: priced.includesTravel,
      forfeit: policyFeeForfeitsService(input.action),
      computed: net.computed,
      charged: net.charged,
      waiver: net.waiver,
      tender: net.charged > 0 ? "card" : null,
      actorId: input.customerId,
      changePayload: {
        action: input.action,
        appointmentIds: input.rows.map((row) => row.id),
        rescheduleTo: input.rescheduleTo ?? null,
      },
      expectedAmount: input.expectedAmount,
    });
  } catch (error) {
    console.error("beginPolicyFeeClaim failed:", error);
    return { error: "server" };
  }

  if (begun.outcome === "fee_changed" || begun.outcome === "amount_mismatch") {
    return { error: "fee_changed" };
  }
  if (begun.outcome === "visit_busy") return { error: "visit_busy" };
  if (begun.outcome === "coverage_conflict") return { error: "conflict" };
  if (begun.outcome !== "created" && begun.outcome !== "existing") {
    return { error: "server" };
  }

  let claim = begun.claim;
  try {
    claim = (await loadPolicyFeeClaim(begun.claim.id)) ?? begun.claim;
  } catch (error) {
    console.error("loadPolicyFeeClaim failed:", error);
    return { error: "server" };
  }
  if (claim.appointmentChangeApplied) {
    return { ok: true, fee: claim.chargedAmount, claimId: claim.id, performChange: false };
  }
  if (claim.status === "charged") {
    return { ok: true, fee: claim.chargedAmount, claimId: claim.id, performChange: true };
  }
  if (claim.status === "waived" || claim.status === "no_fee" || claim.chargedAmount <= 0) {
    return { ok: true, fee: claim.chargedAmount, claimId: claim.id, performChange: true };
  }

  const needsNewCardCharge =
    claim.paymentState === "none" &&
    !claim.stripeSubmittedAt &&
    !claim.stripePaymentIntentId;
  if (needsNewCardCharge && (!method || !stripeCustomerId)) {
    method =
      method ??
      (await resolvePaymentMethod(input.customerId, first.payment_method_id ?? null));
    if (!method) return { error: "payment_required" };
    stripeCustomerId =
      stripeCustomerId ??
      (await getOrCreateStripeCustomerId(input.customerId, input.customerEmail));
    if (!stripeCustomerId) return { error: "server" };
  }
  const savedMethod = method;
  const savedCustomerId = stripeCustomerId;
  if (needsNewCardCharge && (!savedMethod || !savedCustomerId)) return { error: "server" };
  const stripe = getStripe();
  if (!stripe || !isStripeConfigured()) return { error: "misconfigured" };

  const admin = createAdminClient();
  const execution = await executePolicyFee(
    {
      loadClaim: async () => (await loadPolicyFeeClaim(claim.id)) ?? claim,
      reserveStripeSubmit: reservePolicyFeeStripeSubmit,
      searchPaymentIntents: (payment) =>
        searchStripePolicyPayment(stripe, payment.claimId, payment.idempotencyKey),
      recordPayment: recordPolicyFeePayment,
      markUnknown: markPolicyFeePaymentUnknown,
      claimAppointmentChange: acquirePolicyFeeChange,
      createPaymentIntent: async (payment) => {
        if (!savedMethod || !savedCustomerId) {
          throw new Error("saved card is required for a new charge");
        }
        const intent = await stripe.paymentIntents.create(
          {
            amount: payment.amountCents || dollarsToCents(claim.chargedAmount),
            currency: "usd",
            customer: savedCustomerId,
            payment_method: savedMethod.stripePaymentMethodId,
            confirm: true,
            off_session: true,
            description: `K9 Atelier ${input.action.replaceAll("_", " ")} fee`,
            metadata: policyFeeStripeMetadata({
              claimId: claim.id,
              idempotencyKey: payment.idempotencyKey,
              appointmentId: first.id,
              kind: "cancellation",
            }),
          },
          { idempotencyKey: payment.idempotencyKey },
        );
        return { id: intent.id, status: intent.status };
      },
      retrievePaymentIntent: async (id) => {
        const intent = await stripe.paymentIntents.retrieve(id);
        return { id: intent.id, status: intent.status };
      },
      recordCharge: async ({ claimId, paymentIntentId }) => {
        const line: ChargeLineItem = {
          id: randomUUID(),
          label: feeLabel(input.action),
          amount: claim.chargedAmount,
        };
        const { data, error } = await admin
          .from("appointment_charges")
          .insert({
            appointment_id: first.id,
            visit_id: input.visitId,
            claim_id: claimId,
            kind: "cancellation",
            status: "paid",
            line_items: [line],
            subtotal: claim.chargedAmount,
            tip_amount: 0,
            total: claim.chargedAmount,
            created_by: input.customerId,
            payment_method_id: savedMethod?.id ?? null,
            tender: "card",
            stripe_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error?.code === "23505") {
          const { data: existing } = await admin
            .from("appointment_charges")
            .select("id")
            .eq("claim_id", claimId)
            .maybeSingle();
          if (existing?.id) return { chargeId: existing.id as string };
        }
        if (error || !data) throw error ?? new Error("charge insert failed");
        return { chargeId: data.id as string };
      },
      completeClaim: completePolicyFeeClaim,
      failClaim: (claimId) => failPolicyFeeClaim(claimId, "card_declined"),
      applyAppointmentChange: async () => undefined,
      markChangeApplied: async () => false,
    },
    { settlePaymentOnly: true },
  );

  if (execution.outcome === "declined") return { error: "payment_failed" };
  if (execution.outcome === "in_progress") return { error: "payment_pending" };
  if (execution.outcome === "needs_review") return { error: "payment_unknown" };
  return {
    ok: true,
    fee: claim.chargedAmount,
    claimId: claim.id,
    performChange: true,
    cardBrand: savedMethod?.brand,
    cardLast4: savedMethod?.last4,
  };
}

export async function finishCustomerPolicyChange(claimId: string) {
  await markPolicyFeeChangeApplied(claimId);
}
