import { createAdminClient } from "@/lib/supabase/admin";
import { applyFixedCollectCap } from "@/lib/policy-fees/amounts";
import type { ActiveCoverage } from "@/lib/policy-fees/coverage";
import { legacyChargeNeedsReview } from "@/lib/policy-fees/coverage";
import type { PolicyClaimSnapshot } from "@/lib/policy-fees/execute";
import type { PolicyFeeAction } from "@/lib/policy-fees/keys";

export type BeginClaimInput = {
  idempotencyKey: string;
  visitId: string;
  action: PolicyFeeAction;
  appointmentId?: string | null;
  affectedAppointmentIds: string[];
  includesTravel: boolean;
  forfeit: boolean;
  computed: number;
  charged: number;
  waiver: number;
  tender: "card" | "cash" | "zelle" | null;
  actorId: string;
  changePayload: Record<string, unknown>;
  expectedAmount?: number | null;
};

export type BeginClaimResult =
  | {
      outcome: "created" | "existing";
      claim: PolicyClaimSnapshot;
      computed: number;
      waiver: number;
      collectCap: number | null;
    }
  | {
      outcome:
        | "fee_changed"
        | "amount_mismatch"
        | "visit_busy"
        | "coverage_conflict"
        | "no_show_not_confirmed"
        | "reopen_required"
        | "invalid";
      charged?: number;
    };

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function snapshotFromRpc(row: Record<string, unknown>): PolicyClaimSnapshot {
  const tender = row.tender;
  return {
    id: String(row.claim_id),
    status: row.status as PolicyClaimSnapshot["status"],
    chargedAmount: Number(row.charged ?? 0),
    stripeIdempotencyKey: String(row.stripe_idempotency_key ?? ""),
    stripePaymentIntentId:
      typeof row.stripe_payment_intent_id === "string"
        ? row.stripe_payment_intent_id
        : null,
    appointmentChangeApplied: Boolean(row.appointment_change_applied),
    chargeId: typeof row.charge_id === "string" ? row.charge_id : null,
    tender:
      tender === "card" || tender === "cash" || tender === "zelle" ? tender : null,
  };
}

export async function loadActiveCoverage(visitId: string): Promise<ActiveCoverage> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("policy_fee_coverage")
    .select("appointment_id, component")
    .eq("visit_id", visitId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  const appointmentIds = (data ?? [])
    .map((row) => row.appointment_id as string | null)
    .filter((id): id is string => Boolean(id));
  return {
    appointmentIds,
    travel: (data ?? []).some((row) => row.component === "travel"),
  };
}

export async function visitHasUnreviewedLegacyPolicyCharge(visitId: string) {
  const admin = createAdminClient();
  const { data: appointments, error: appointmentError } = await admin
    .from("appointments")
    .select("id")
    .eq("visit_id", visitId);
  if (appointmentError) throw new Error(appointmentError.message);
  const appointmentIds = (appointments ?? []).map((row) => row.id as string);
  if (appointmentIds.length === 0) return false;
  const { data: charges, error } = await admin
    .from("appointment_charges")
    .select("id, kind, status, claim_id")
    .in("appointment_id", appointmentIds)
    .in("kind", ["cancellation", "no_show"]);
  if (error) throw new Error(error.message);
  const ids = (charges ?? []).map((row) => row.id as string);
  if (ids.length === 0) return false;
  const { data: reviews, error: reviewError } = await admin
    .from("policy_fee_legacy_reviews")
    .select("charge_id")
    .in("charge_id", ids);
  if (reviewError) throw new Error(reviewError.message);
  const reviewed = new Set((reviews ?? []).map((row) => row.charge_id as string));
  return (charges ?? []).some((row) =>
    legacyChargeNeedsReview({
      kind: row.kind as string,
      status: row.status as string,
      claimId: (row.claim_id as string | null) ?? null,
      reviewed: reviewed.has(row.id as string),
    }),
  );
}

export async function loadAuthorizedCap(idempotencyKey: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fee_waivers")
    .select("collect_cap")
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "authorized")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return Number(data.collect_cap);
}

export async function loadAuthorizedReopen(visitId: string, action: PolicyFeeAction) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("policy_fee_reopens")
    .select("id, idempotency_key")
    .eq("visit_id", visitId)
    .eq("action", action)
    .eq("status", "authorized")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.idempotency_key) return null;
  return {
    id: data.id as string,
    idempotencyKey: data.idempotency_key as string,
  };
}

export function priceWithCap(computed: number, collectCap: number | null) {
  return applyFixedCollectCap(computed, collectCap);
}

export async function beginPolicyFeeClaim(
  input: BeginClaimInput,
): Promise<BeginClaimResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_policy_fee_claim", {
    p_input: {
      idempotency_key: input.idempotencyKey,
      visit_id: input.visitId,
      action: input.action,
      appointment_id: input.appointmentId ?? null,
      affected_appointment_ids: input.affectedAppointmentIds,
      includes_travel: input.includesTravel,
      forfeit: input.forfeit,
      computed: input.computed,
      charged: input.charged,
      waiver: input.waiver,
      tender: input.tender,
      actor_id: input.actorId,
      change_payload: input.changePayload,
      expected_amount: input.expectedAmount ?? null,
    },
  });
  if (error) throw new Error(error.message);
  const row = asRecord(data);
  const outcome = String(row.outcome ?? "invalid");
  if (outcome === "created" || outcome === "existing") {
    return {
      outcome,
      claim: snapshotFromRpc(row),
      computed: Number(row.computed ?? input.computed),
      waiver: Number(row.waiver ?? input.waiver),
      collectCap:
        row.collect_cap == null || row.collect_cap === ""
          ? null
          : Number(row.collect_cap),
    };
  }
  return {
    outcome: outcome as Exclude<BeginClaimResult, { outcome: "created" | "existing" }>["outcome"],
    charged: row.charged == null ? undefined : Number(row.charged),
  };
}

export async function recordPolicyFeeIntent(claimId: string, paymentIntentId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_policy_fee_intent", {
    p_claim_id: claimId,
    p_payment_intent_id: paymentIntentId,
  });
  if (error) throw new Error(error.message);
  const outcome = String(asRecord(data).outcome ?? "");
  if (outcome === "different_intent") {
    throw new Error("different_intent");
  }
}

export async function completePolicyFeeClaim(claimId: string, chargeId: string | null) {
  if (!chargeId) throw new Error("policy fee charge is missing");
  const admin = createAdminClient();
  const { error } = await admin.rpc("complete_policy_fee_claim", {
    p_claim_id: claimId,
    p_charge_id: chargeId,
  });
  if (error) throw new Error(error.message);
}

export async function failPolicyFeeClaim(claimId: string, reason: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("fail_policy_fee_claim", {
    p_claim_id: claimId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function markPolicyFeeChangeApplied(claimId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("mark_policy_fee_change_applied", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
}
