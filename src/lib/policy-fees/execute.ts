import { dollarsToCents } from "@/lib/charges/money";

export type PolicyClaimStatus =
  | "charging"
  | "charged"
  | "waived"
  | "failed"
  | "no_fee";

export type PolicyPaymentState =
  | "none"
  | "submitting"
  | "awaiting_customer"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "unknown";

export type PolicyClaimSnapshot = {
  id: string;
  status: PolicyClaimStatus;
  chargedAmount: number;
  stripeIdempotencyKey: string;
  stripePaymentIntentId: string | null;
  appointmentChangeApplied: boolean;
  chargeId: string | null;
  tender: "card" | "cash" | "zelle" | null;
  paymentState: PolicyPaymentState;
  stripeSubmittedAt: string | null;
};

export type PolicyIntentSnapshot = {
  id: string;
  status: string;
};

export type PolicyFeeStep =
  | { type: "create_intent" }
  | { type: "retrieve_intent" }
  | { type: "reconcile" }
  | { type: "record_manual_payment" }
  | { type: "apply_change" }
  | { type: "done" }
  | { type: "fail_declined" };

export type PolicySearchResult =
  | { outcome: "found"; intent: PolicyIntentSnapshot }
  | { outcome: "none" | "ambiguous" | "unavailable" };

export type PolicyReserveResult =
  | { outcome: "submit"; idempotencyKey: string }
  | { outcome: "known"; paymentIntentId: string }
  | { outcome: "reconcile" };

const DEFINITE_FAILURE = new Set(["failed", "canceled"]);

export function paymentStateFromStripe(status: string): PolicyPaymentState {
  if (status === "succeeded") return "succeeded";
  if (status === "canceled") return "canceled";
  if (status === "requires_payment_method") return "failed";
  if (status === "requires_action" || status === "requires_confirmation") {
    return "awaiting_customer";
  }
  if (status === "processing" || status === "requires_capture") return "processing";
  return "unknown";
}

export function nextPolicyFeeStep(claim: PolicyClaimSnapshot): PolicyFeeStep {
  if (
    claim.status === "charged" ||
    claim.status === "waived" ||
    claim.status === "no_fee"
  ) {
    return claim.appointmentChangeApplied
      ? { type: "done" }
      : { type: "apply_change" };
  }
  if (claim.status === "failed") return { type: "done" };
  if (claim.chargedAmount <= 0) {
    return claim.appointmentChangeApplied
      ? { type: "done" }
      : { type: "apply_change" };
  }
  if (claim.tender === "cash" || claim.tender === "zelle") {
    return claim.chargeId ? { type: "apply_change" } : { type: "record_manual_payment" };
  }
  if (claim.stripePaymentIntentId) return { type: "retrieve_intent" };
  if (claim.paymentState === "none" && !claim.stripeSubmittedAt) {
    return { type: "create_intent" };
  }
  return { type: "reconcile" };
}

export function intentFollowUp(status: string): "paid" | "pending" | "declined" | "unknown" {
  const state = paymentStateFromStripe(status);
  if (state === "succeeded") return "paid";
  if (state === "awaiting_customer" || state === "processing") return "pending";
  if (DEFINITE_FAILURE.has(state)) return "declined";
  return "unknown";
}

export type PolicyFeeExecutorDeps = {
  loadClaim: () => Promise<PolicyClaimSnapshot>;
  createPaymentIntent: (input: {
    idempotencyKey: string;
    amountCents: number;
    claimId: string;
  }) => Promise<PolicyIntentSnapshot>;
  retrievePaymentIntent: (id: string) => Promise<PolicyIntentSnapshot>;
  searchPaymentIntents: (input: {
    claimId: string;
    idempotencyKey: string;
  }) => Promise<PolicySearchResult>;
  reserveStripeSubmit: (claimId: string) => Promise<PolicyReserveResult>;
  recordPayment: (
    claimId: string,
    paymentIntentId: string,
    state: PolicyPaymentState,
  ) => Promise<void>;
  markUnknown: (claimId: string) => Promise<void>;
  recordCharge: (input: {
    claimId: string;
    paymentIntentId: string | null;
  }) => Promise<{ chargeId: string }>;
  completeClaim: (claimId: string, chargeId: string | null) => Promise<void>;
  failClaim: (claimId: string, paymentIntentId: string | null) => Promise<void>;
  claimAppointmentChange: (
    claimId: string,
  ) => Promise<"apply" | "resume" | "already" | "busy" | "review" | "not_ready" | "missing">;
  applyAppointmentChange: (claimId: string) => Promise<void>;
  markChangeApplied: (claimId: string) => Promise<boolean>;
};

export type PolicyFeeExecution = {
  outcome:
    | "settled"
    | "in_progress"
    | "declined"
    | "change_applied"
    | "ready_to_change"
    | "needs_review"
    | "change_pending";
  paymentIntentIds: string[];
  changeApplications: number;
};

/**
 * A card create is allowed only before Stripe has been asked.
 * After that, recovery retrieves or searches. An empty search does not
 * create another PaymentIntent and does not mark the claim failed.
 */
export async function executePolicyFee(
  deps: PolicyFeeExecutorDeps,
  options?: { settlePaymentOnly?: boolean },
): Promise<PolicyFeeExecution> {
  const seenIntents: string[] = [];
  let changeApplications = 0;

  async function finishChange(claim: PolicyClaimSnapshot) {
    if (claim.appointmentChangeApplied) {
      return {
        outcome: "settled" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    const gate = await deps.claimAppointmentChange(claim.id);
    if (gate === "already") {
      return {
        outcome: "settled" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    if (gate !== "apply" && gate !== "resume") {
      return {
        outcome: "change_pending" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    await deps.applyAppointmentChange(claim.id);
    changeApplications += 1;
    await deps.markChangeApplied(claim.id);
    return {
      outcome: "change_applied" as const,
      paymentIntentIds: seenIntents,
      changeApplications,
    };
  }

  async function needsReview(claimId: string) {
    await deps.markUnknown(claimId);
    return {
      outcome: "needs_review" as const,
      paymentIntentIds: seenIntents,
      changeApplications,
    };
  }

  async function follow(claim: PolicyClaimSnapshot, intent: PolicyIntentSnapshot) {
    seenIntents.push(intent.id);
    const state = paymentStateFromStripe(intent.status);
    if (state === "unknown") {
      await deps.recordPayment(claim.id, intent.id, state);
      return {
        outcome: "needs_review" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    await deps.recordPayment(claim.id, intent.id, state);
    const followUp = intentFollowUp(intent.status);
    if (followUp === "pending") {
      return {
        outcome: "in_progress" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    if (followUp === "unknown") return needsReview(claim.id);
    if (followUp === "declined") {
      await deps.failClaim(claim.id, intent.id);
      return {
        outcome: "declined" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    const charge = claim.chargeId
      ? { chargeId: claim.chargeId }
      : await deps.recordCharge({ claimId: claim.id, paymentIntentId: intent.id });
    await deps.completeClaim(claim.id, charge.chargeId);
    const settledClaim: PolicyClaimSnapshot = {
      ...claim,
      status: "charged",
      chargeId: charge.chargeId,
      stripePaymentIntentId: intent.id,
      paymentState: "succeeded",
    };
    if (options?.settlePaymentOnly) {
      return {
        outcome: "ready_to_change" as const,
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    return finishChange(settledClaim);
  }

  async function reconcile(claim: PolicyClaimSnapshot): Promise<PolicyFeeExecution> {
    if (claim.stripePaymentIntentId) {
      const intent = await deps.retrievePaymentIntent(claim.stripePaymentIntentId);
      return follow(claim, intent);
    }
    const found = await deps.searchPaymentIntents({
      claimId: claim.id,
      idempotencyKey: claim.stripeIdempotencyKey,
    });
    if (found.outcome === "found") return follow(claim, found.intent);
    return needsReview(claim.id);
  }

  const claim = await deps.loadClaim();
  const step = nextPolicyFeeStep(claim);

  if (step.type === "done") {
    return { outcome: "settled", paymentIntentIds: seenIntents, changeApplications };
  }
  if (step.type === "apply_change") {
    if (options?.settlePaymentOnly) {
      return {
        outcome: "ready_to_change",
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    return finishChange(claim);
  }
  if (step.type === "record_manual_payment") {
    const charge = await deps.recordCharge({
      claimId: claim.id,
      paymentIntentId: null,
    });
    await deps.completeClaim(claim.id, charge.chargeId);
    if (options?.settlePaymentOnly) {
      return {
        outcome: "ready_to_change",
        paymentIntentIds: seenIntents,
        changeApplications,
      };
    }
    return finishChange({
      ...claim,
      status: "charged",
      chargeId: charge.chargeId,
    });
  }
  if (step.type === "reconcile" || step.type === "retrieve_intent") {
    return reconcile(claim);
  }

  const reserved = await deps.reserveStripeSubmit(claim.id);
  if (reserved.outcome !== "submit") {
    const current = await deps.loadClaim();
    return reconcile(current);
  }
  const intent = await deps.createPaymentIntent({
    idempotencyKey: reserved.idempotencyKey,
    amountCents: dollarsToCents(claim.chargedAmount),
    claimId: claim.id,
  });
  return follow(claim, intent);
}
