import { randomUUID } from "crypto";
import { dollarsToCents } from "@/lib/charges/money";
import type {
  AppointmentChargeRecord,
  ChargeLineItem,
  ChargeTender,
} from "@/lib/charges/types";
import { isManualTender } from "@/lib/charges/tender";
import { executePolicyFee } from "@/lib/policy-fees/execute";
import { policyFeeFromRows, type PolicyPriceRow } from "@/lib/policy-fees/coverage";
import {
  beginPolicyFeeClaim,
  completePolicyFeeClaim,
  failPolicyFeeClaim,
  loadActiveCoverage,
  loadAuthorizedCap,
  loadAuthorizedReopen,
  priceWithCap,
  recordPolicyFeeIntent,
  visitHasUnreviewedLegacyPolicyCharge,
} from "@/lib/policy-fees/db";
import { policyFeeIdempotencyKey } from "@/lib/policy-fees/keys";
import { getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateStripeCustomerId } from "@/lib/payments/service";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";

const PRICE_SELECT = `
  id, customer_id, visit_id, status, appointment_date, scheduled_start,
  service_price, estimated_total, travel_fee, add_on_ids, add_on_options,
  payment_method_id, pet_id
`;

type NoShowRow = PolicyPriceRow & {
  customer_id: string;
  visit_id: string | null;
  status: string;
  appointment_date: string;
  scheduled_start: number | null;
  payment_method_id: string | null;
};

type NoShowPreview =
  | {
      error: "unauthenticated" | "forbidden" | "conflict" | "server";
      message?: string;
    }
  | {
      visitId: string;
      computed: number;
      collectCap: number | null;
      charged: number;
      waiver: number;
      includesTravel: boolean;
      affectedAppointmentIds: string[];
      idempotencyKey: string;
    };

export async function previewNoShowFee(appointmentId: string): Promise<NoShowPreview> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  const loaded = await loadVisitRows(appointmentId);
  if ("error" in loaded) {
    return loaded.error === "conflict"
      ? { error: "conflict", message: loaded.message }
      : { error: "server" };
  }
  if (await visitHasUnreviewedLegacyPolicyCharge(loaded.visitId)) {
    return {
      error: "conflict" as const,
      message: "Review the older fee on this visit before charging a no-show.",
    };
  }
  const priced = policyFeeFromRows({
    action: "no_show",
    rows: loaded.rows,
    coverage: await loadActiveCoverage(loaded.visitId),
    band: "same_day",
  });
  if (!priced.ok) {
    return {
      error: "conflict" as const,
      message: "This visit needs a price review before a no-show fee can be charged.",
    };
  }
  const key = await noShowKey(loaded.visitId);
  const cap = await loadAuthorizedCap(key);
  const net = priceWithCap(priced.computed, cap);
  if (!net.ok) return { error: "server" as const };
  return {
    visitId: loaded.visitId,
    computed: net.computed,
    collectCap: net.collectCap,
    charged: net.charged,
    waiver: net.waiver,
    includesTravel: priced.includesTravel,
    affectedAppointmentIds: priced.affectedAppointmentIds,
    idempotencyKey: key,
  };
}

async function noShowKey(visitId: string) {
  const base = policyFeeIdempotencyKey({ action: "no_show", visitId });
  const reopen = await loadAuthorizedReopen(visitId, "no_show");
  if (!reopen) return base;
  const admin = createAdminClient();
  const { data } = await admin
    .from("policy_fee_claims")
    .select("status")
    .eq("idempotency_key", base)
    .maybeSingle();
  if (data && data.status !== "failed") return reopen.idempotencyKey;
  return base;
}

async function loadVisitRows(appointmentId: string) {
  const admin = createAdminClient();
  const { data: opened, error } = await admin
    .from("appointments")
    .select(PRICE_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) return { error: "server" as const };
  if (!opened?.visit_id) {
    return {
      error: "conflict" as const,
      message: "This appointment is not attached to a visit yet.",
    };
  }
  const { data: rows, error: rowError } = await admin
    .from("appointments")
    .select(PRICE_SELECT)
    .eq("visit_id", opened.visit_id)
    .neq("status", "cancelled");
  if (rowError) return { error: "server" as const };
  return {
    visitId: opened.visit_id as string,
    opened: opened as NoShowRow,
    rows: (rows ?? []) as NoShowRow[],
  };
}

export async function chargeNoShow(input: {
  appointmentId: string;
  tender: ChargeTender;
  paymentMethodId?: string;
  useNewCard?: boolean;
}) {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (input.useNewCard) {
    return {
      error: "conflict" as const,
      message: "Use the card on file, cash, or Zelle for a no-show fee.",
    };
  }
  const preview = await previewNoShowFee(input.appointmentId);
  if ("error" in preview) return preview;
  const loaded = await loadVisitRows(input.appointmentId);
  if ("error" in loaded) return loaded;
  const manual = isManualTender(input.tender);
  if (!manual && !input.paymentMethodId) {
    return { error: "conflict" as const, message: "Select a saved card." };
  }

  let begun;
  try {
    begun = await beginPolicyFeeClaim({
      idempotencyKey: preview.idempotencyKey,
      visitId: preview.visitId,
      action: "no_show",
      appointmentId: input.appointmentId,
      affectedAppointmentIds: preview.affectedAppointmentIds,
      includesTravel: preview.includesTravel,
      forfeit: true,
      computed: preview.computed,
      charged: preview.charged,
      waiver: preview.waiver,
      tender: preview.charged > 0 ? input.tender : null,
      actorId: session.user.id,
      changePayload: { action: "no_show", appointmentId: input.appointmentId },
    });
  } catch (error) {
    console.error("chargeNoShow begin failed:", error);
    return { error: "server" as const };
  }
  if (begun.outcome === "no_show_not_confirmed") {
    return {
      error: "conflict" as const,
      message: "Confirm the no-show evidence before charging.",
    };
  }
  if (begun.outcome === "coverage_conflict") {
    return {
      error: "conflict" as const,
      message: "A cancellation fee already covers this no-show balance.",
    };
  }
  if (begun.outcome === "visit_busy") {
    return {
      error: "conflict" as const,
      message: "Another fee for this visit is still finishing.",
    };
  }
  if (begun.outcome !== "created" && begun.outcome !== "existing") {
    return { error: "server" as const };
  }
  const claim = begun.claim;
  if (claim.status === "charged" && claim.chargeId) {
    const charge = await loadChargeByClaim(claim.id);
    if (!charge) {
      return { error: "conflict" as const, message: "This no-show fee is already charged." };
    }
    return { charge };
  }
  if (claim.chargedAmount <= 0) {
    return {
      error: "conflict" as const,
      message:
        claim.status === "waived"
          ? "This no-show fee is fully waived. Nothing was charged."
          : "This visit has no remaining no-show balance.",
    };
  }

  const admin = createAdminClient();
  if (manual) {
    const execution = await executePolicyFee(
      {
        loadClaim: async () => ({ ...claim, tender: input.tender }),
        createPaymentIntent: async () => {
          throw new Error("manual no-show does not call Stripe");
        },
        retrievePaymentIntent: async () => {
          throw new Error("manual no-show does not call Stripe");
        },
        savePaymentIntentId: async () => undefined,
        recordCharge: ({ claimId }) =>
          insertNoShowCharge({
            appointmentId: input.appointmentId,
            visitId: preview.visitId,
            claimId,
            amount: claim.chargedAmount,
            actorId: session.user.id,
            tender: input.tender,
            paymentIntentId: null,
            paymentMethodId: null,
            status: "paid",
          }),
        completeClaim: completePolicyFeeClaim,
        failClaim: (claimId) => failPolicyFeeClaim(claimId, "manual_failed"),
        applyAppointmentChange: async () => undefined,
        markChangeApplied: async () => true,
      },
      { settlePaymentOnly: true },
    );
    if (execution.outcome === "declined") {
      return { error: "declined" as const, message: "The no-show fee was not recorded." };
    }
    await linkNoShowCharge(preview.visitId, claim.id);
    const charge = await loadChargeByClaim(claim.id);
    if (!charge) return { error: "server" as const };
    return { charge };
  }

  const method = await admin
    .from("payment_methods")
    .select("id, stripe_payment_method_id")
    .eq("id", input.paymentMethodId)
    .eq("customer_id", loaded.opened.customer_id)
    .maybeSingle();
  const stripePaymentMethodId = method.data?.stripe_payment_method_id;
  if (!stripePaymentMethodId) {
    return { error: "conflict" as const, message: "That card is no longer on file." };
  }
  const stripe = getStripe();
  if (!stripe || !isStripeConfigured()) return { error: "misconfigured" as const };
  const stripeCustomerId = await getOrCreateStripeCustomerId(
    loaded.opened.customer_id,
    undefined,
  );
  if (!stripeCustomerId) return { error: "server" as const };

  const execution = await executePolicyFee(
    {
      loadClaim: async () => ({ ...claim, tender: "card" }),
      createPaymentIntent: async (payment) => {
        const intent = await stripe.paymentIntents.create(
          {
            amount: payment.amountCents || dollarsToCents(claim.chargedAmount),
            currency: "usd",
            customer: stripeCustomerId,
            payment_method: stripePaymentMethodId,
            confirm: true,
            off_session: true,
            description: "K9 Atelier no-show fee",
            metadata: {
              appointment_id: input.appointmentId,
              claim_id: claim.id,
              kind: "no_show",
            },
          },
          { idempotencyKey: payment.idempotencyKey },
        );
        return { id: intent.id, status: intent.status };
      },
      retrievePaymentIntent: async (id) => {
        const intent = await stripe.paymentIntents.retrieve(id);
        return { id: intent.id, status: intent.status };
      },
      savePaymentIntentId: recordPolicyFeeIntent,
      recordCharge: ({ claimId, paymentIntentId }) =>
        insertNoShowCharge({
          appointmentId: input.appointmentId,
          visitId: preview.visitId,
          claimId,
          amount: claim.chargedAmount,
          actorId: session.user.id,
          tender: "card",
          paymentIntentId,
          paymentMethodId: input.paymentMethodId ?? null,
          status: "paid",
        }),
      completeClaim: completePolicyFeeClaim,
      failClaim: (claimId) => failPolicyFeeClaim(claimId, "card_declined"),
      applyAppointmentChange: async () => undefined,
      markChangeApplied: async () => true,
    },
    { settlePaymentOnly: true },
  );
  if (execution.outcome === "in_progress") {
    return {
      error: "pending" as const,
      message:
        "This card is waiting for the customer. Nothing else was charged, and this no-show cannot be collected again until the attempt finishes or is declined.",
    };
  }
  if (execution.outcome === "declined") {
    return { error: "declined" as const, message: "This card could not be charged." };
  }
  await linkNoShowCharge(preview.visitId, claim.id);
  const charge = await loadChargeByClaim(claim.id);
  if (!charge) return { error: "server" as const };
  return { charge };
}

async function insertNoShowCharge(input: {
  appointmentId: string;
  visitId: string;
  claimId: string;
  amount: number;
  actorId: string;
  tender: ChargeTender;
  paymentIntentId: string | null;
  paymentMethodId: string | null;
  status: "paid" | "pending";
}) {
  const admin = createAdminClient();
  const line: ChargeLineItem = {
    id: randomUUID(),
    label: "No-show fee",
    amount: input.amount,
    catalogId: "no-show",
  };
  const { data, error } = await admin
    .from("appointment_charges")
    .insert({
      appointment_id: input.appointmentId,
      visit_id: input.visitId,
      claim_id: input.claimId,
      kind: "no_show",
      status: input.status,
      line_items: [line],
      subtotal: input.amount,
      tip_amount: 0,
      total: input.amount,
      created_by: input.actorId,
      payment_method_id: input.paymentMethodId,
      tender: input.tender,
      stripe_payment_intent_id: input.paymentIntentId,
      paid_at: input.status === "paid" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: existing } = await admin
      .from("appointment_charges")
      .select("id")
      .eq("claim_id", input.claimId)
      .maybeSingle();
    if (existing?.id) return { chargeId: existing.id as string };
  }
  if (error || !data) throw error ?? new Error("no-show charge insert failed");
  return { chargeId: data.id as string };
}

const NO_SHOW_CHARGE_SELECT =
  "id, appointment_id, visit_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, refunded_amount, payment_method_id, tender";

async function loadChargeByClaim(claimId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointment_charges")
    .select(NO_SHOW_CHARGE_SELECT)
    .eq("claim_id", claimId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    appointmentId: data.appointment_id as string,
    visitId: (data.visit_id as string | null) ?? null,
    kind: data.kind as AppointmentChargeRecord["kind"],
    status: data.status as AppointmentChargeRecord["status"],
    lineItems: (data.line_items ?? []) as ChargeLineItem[],
    subtotal: Number(data.subtotal),
    tipAmount: Number(data.tip_amount),
    total: Number(data.total),
    receiptChannel: (data.receipt_channel ?? null) as AppointmentChargeRecord["receiptChannel"],
    paidAt: (data.paid_at as string | null) ?? null,
    refundedAmount: Number(data.refunded_amount ?? 0),
    paymentMethodId: (data.payment_method_id as string | null) ?? null,
    tender: (data.tender ?? "card") as ChargeTender,
  } satisfies AppointmentChargeRecord;
}

async function linkNoShowCharge(visitId: string, claimId: string) {
  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("policy_fee_claims")
    .select("charge_id")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim?.charge_id) return;
  await admin
    .from("visit_no_show_reports")
    .update({ charge_id: claim.charge_id })
    .eq("visit_id", visitId)
    .eq("status", "confirmed")
    .is("charge_id", null);
}
