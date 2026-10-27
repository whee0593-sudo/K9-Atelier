import { createAdminClient } from "@/lib/supabase/admin";
import { applyFixedCollectCap } from "@/lib/policy-fees/amounts";
import type { ActiveCoverage } from "@/lib/policy-fees/coverage";
import { legacyChargeNeedsReview } from "@/lib/policy-fees/coverage";
import {
  changePhaseFrom,
  type CalendarWriteResult,
  type ChangeMarkResult,
  type ChangePhase,
  type RecoveryClaim,
} from "@/lib/policy-fees/change-recovery";
import type {
  PolicyClaimSnapshot,
  PolicyClaimStatus,
  PolicyPaymentState,
  PolicyReserveResult,
} from "@/lib/policy-fees/execute";
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
    paymentState: paymentStateFrom(row.payment_state),
    stripeSubmittedAt:
      typeof row.stripe_submitted_at === "string" ? row.stripe_submitted_at : null,
  };
}

const PAYMENT_STATES = new Set<PolicyPaymentState>([
  "none",
  "submitting",
  "awaiting_customer",
  "processing",
  "succeeded",
  "failed",
  "canceled",
  "unknown",
]);

function paymentStateFrom(value: unknown): PolicyPaymentState {
  return typeof value === "string" && PAYMENT_STATES.has(value as PolicyPaymentState)
    ? (value as PolicyPaymentState)
    : "none";
}

export async function loadPolicyFeeClaim(claimId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("policy_fee_claims")
    .select(
      "id, status, charged_amount, stripe_idempotency_key, stripe_payment_intent_id, appointment_change_applied, charge_id, tender, payment_state, stripe_submitted_at",
    )
    .eq("id", claimId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return snapshotFromRpc({
    claim_id: data.id,
    status: data.status,
    charged: data.charged_amount,
    stripe_idempotency_key: data.stripe_idempotency_key,
    stripe_payment_intent_id: data.stripe_payment_intent_id,
    appointment_change_applied: data.appointment_change_applied,
    charge_id: data.charge_id,
    tender: data.tender,
    payment_state: data.payment_state,
    stripe_submitted_at: data.stripe_submitted_at,
  });
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

export async function reservePolicyFeeStripeSubmit(
  claimId: string,
): Promise<PolicyReserveResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_policy_fee_stripe_submit", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
  const row = asRecord(data);
  const outcome = String(row.outcome ?? "");
  if (outcome === "submit") {
    return {
      outcome: "submit",
      idempotencyKey: String(row.stripe_idempotency_key ?? ""),
    };
  }
  if (outcome === "known") {
    return { outcome: "known", paymentIntentId: String(row.payment_intent_id ?? "") };
  }
  if (outcome === "reconcile") return { outcome: "reconcile" };
  throw new Error(outcome || "reserve_failed");
}

export async function recordPolicyFeePayment(
  claimId: string,
  paymentIntentId: string,
  state: PolicyPaymentState,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_policy_fee_payment", {
    p_claim_id: claimId,
    p_payment_intent_id: paymentIntentId,
    p_state: state,
  });
  if (error) throw new Error(error.message);
  const outcome = String(asRecord(data).outcome ?? "");
  if (outcome === "different_intent" || outcome === "invalid" || outcome === "not_charging") {
    throw new Error(outcome);
  }
}

export async function markPolicyFeePaymentUnknown(claimId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("mark_policy_fee_payment_unknown", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
  const outcome = String(asRecord(data).outcome ?? "");
  if (outcome === "not_charging") throw new Error(outcome);
}

export async function acquirePolicyFeeChange(claimId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("acquire_policy_fee_change", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
  const outcome = String(asRecord(data).outcome ?? "");
  if (
    outcome === "apply" ||
    outcome === "resume" ||
    outcome === "already" ||
    outcome === "busy" ||
    outcome === "review" ||
    outcome === "not_ready" ||
    outcome === "missing"
  ) {
    return outcome;
  }
  return "not_ready" as const;
}

export async function releasePolicyFeeChange(claimId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_policy_fee_change", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
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
  const { data, error } = await admin.rpc("fail_policy_fee_claim", {
    p_claim_id: claimId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  const outcome = String(asRecord(data).outcome ?? "");
  if (outcome === "unconfirmed" || outcome === "not_charging") {
    throw new Error(outcome);
  }
}

export async function markPolicyFeeChangeApplied(claimId: string): Promise<ChangeMarkResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("mark_policy_fee_change_applied", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
  const outcome = String(asRecord(data).outcome ?? "");
  if (
    outcome === "applied" ||
    outcome === "already_applied" ||
    outcome === "not_written" ||
    outcome === "not_ready"
  ) {
    return outcome;
  }
  return "not_ready";
}

export async function applyPolicyFeeCalendar(
  claimId: string,
  plan: unknown,
): Promise<CalendarWriteResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_policy_fee_calendar", {
    p_claim_id: claimId,
    p_plan: plan ?? null,
  });
  if (error) {
    if (error.code === "23505" || /duplicate key|slot/i.test(error.message ?? "")) {
      return "slot_unavailable";
    }
    throw new Error(error.message);
  }
  const outcome = String(asRecord(data).outcome ?? "");
  if (
    outcome === "written" ||
    outcome === "already_written" ||
    outcome === "already" ||
    outcome === "review" ||
    outcome === "not_ready" ||
    outcome === "not_acquired" ||
    outcome === "plan_required" ||
    outcome === "missing"
  ) {
    return outcome;
  }
  return "not_ready";
}

export async function loadPolicyFeeChangeRecovery(claimId: string): Promise<RecoveryClaim | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("policy_fee_claims")
    .select(
      "id, status, action, visit_id, idempotency_key, charged_amount, appointment_change_applied, change_phase, calendar_written_at, change_payload, payment_state",
    )
    .eq("id", claimId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return recoveryFromRow(data as Record<string, unknown>);
}

export async function loadUnfinishedPolicyChange(visitId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("policy_fee_claims")
    .select("id, status, payment_state, change_phase, action, charged_amount")
    .eq("visit_id", visitId)
    .eq("appointment_change_applied", false)
    .in("action", ["cancel", "reschedule", "remove_dog"])
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const status = data.status as PolicyClaimStatus;
  return {
    claimId: data.id as string,
    status,
    paymentState: paymentStateFrom(data.payment_state),
    phase: changePhaseFrom(data.change_phase) as ChangePhase,
    action: data.action as string,
    chargedAmount: Number(data.charged_amount ?? 0),
  };
}

export async function loadLatestAppliedReschedule(visitId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("policy_fee_claims")
    .select("id, charged_amount, change_payload")
    .eq("visit_id", visitId)
    .eq("action", "reschedule")
    .eq("appointment_change_applied", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const payload =
    data.change_payload && typeof data.change_payload === "object"
      ? (data.change_payload as Record<string, unknown>)
      : {};
  const target =
    payload.rescheduleTo && typeof payload.rescheduleTo === "object"
      ? (payload.rescheduleTo as Record<string, unknown>)
      : null;
  return {
    claimId: data.id as string,
    chargedAmount: Number(data.charged_amount ?? 0),
    date: typeof target?.date === "string" ? target.date : null,
    slotStartMinutes:
      typeof target?.slotStartMinutes === "number" ? target.slotStartMinutes : null,
  };
}

function recoveryFromRow(row: Record<string, unknown>): RecoveryClaim {
  const status = row.status;
  return {
    id: String(row.id),
    status:
      status === "charging" ||
      status === "charged" ||
      status === "waived" ||
      status === "failed" ||
      status === "no_fee"
        ? status
        : "charging",
    paymentState: paymentStateFrom(row.payment_state),
    phase: changePhaseFrom(row.change_phase),
    calendarWritten: Boolean(row.calendar_written_at),
    applied: Boolean(row.appointment_change_applied),
    action: String(row.action ?? ""),
    chargedAmount: Number(row.charged_amount ?? 0),
    idempotencyKey: String(row.idempotency_key ?? ""),
    visitId: String(row.visit_id ?? ""),
    payload: row.change_payload,
  };
}
