import { dollarsToCents } from "@/lib/charges/money";

export type PolicyClaimStatus =
  | "charging"
  | "charged"
  | "waived"
  | "failed"
  | "no_fee";

export type PolicyClaimSnapshot = {
  id: string;
  status: PolicyClaimStatus;
  chargedAmount: number;
  stripeIdempotencyKey: string;
  stripePaymentIntentId: string | null;
  appointmentChangeApplied: boolean;
  chargeId: string | null;
  tender: "card" | "cash" | "zelle" | null;
};

export type PolicyIntentSnapshot = {
  id: string;
  status: string;
};

export type PolicyFeeStep =
  | { type: "create_intent" }
  | { type: "retrieve_intent" }
  | { type: "record_manual_payment" }
  | { type: "apply_change" }
  | { type: "done" }
  | { type: "fail_declined" };

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
  return { type: "create_intent" };
}

export function intentFollowUp(status: string): "paid" | "pending" | "declined" {
  if (status === "succeeded") return "paid";
  if (
    status === "processing" ||
    status === "requires_action" ||
    status === "requires_confirmation" ||
    status === "requires_capture"
  ) {
    return "pending";
  }
  return "declined";
}

export type PolicyFeeExecutorDeps = {
  loadClaim: () => Promise<PolicyClaimSnapshot>;
  createPaymentIntent: (input: {
    idempotencyKey: string;
    amountCents: number;
    claimId: string;
  }) => Promise<PolicyIntentSnapshot>;
  retrievePaymentIntent: (id: string) => Promise<PolicyIntentSnapshot>;
  savePaymentIntentId: (claimId: string, paymentIntentId: string) => Promise<void>;
  recordCharge: (input: {
    claimId: string;
    paymentIntentId: string | null;
  }) => Promise<{ chargeId: string }>;
  completeClaim: (claimId: string, chargeId: string | null) => Promise<void>;
  failClaim: (claimId: string, paymentIntentId: string | null) => Promise<void>;
  applyAppointmentChange: (claimId: string) => Promise<void>;
  markChangeApplied: (claimId: string) => Promise<boolean>;
};

export type PolicyFeeExecution = {
  outcome: "settled" | "in_progress" | "declined" | "change_applied" | "ready_to_change";
  paymentIntentIds: string[];
  changeApplications: number;
};

/**
 * One claim, one Stripe idempotency key, one appointment change.
 * A second call loads the saved PaymentIntent instead of creating another.
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
    await deps.applyAppointmentChange(claim.id);
    changeApplications += 1;
    await deps.markChangeApplied(claim.id);
    return {
      outcome: "change_applied" as const,
      paymentIntentIds: seenIntents,
      changeApplications,
    };
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

  const intent =
    step.type === "retrieve_intent"
      ? await deps.retrievePaymentIntent(claim.stripePaymentIntentId as string)
      : await deps.createPaymentIntent({
          idempotencyKey: claim.stripeIdempotencyKey,
          amountCents: dollarsToCents(claim.chargedAmount),
          claimId: claim.id,
        });
  seenIntents.push(intent.id);
  await deps.savePaymentIntentId(claim.id, intent.id);

  const follow = intentFollowUp(intent.status);
  if (follow === "pending") {
    return { outcome: "in_progress", paymentIntentIds: seenIntents, changeApplications };
  }
  if (follow === "declined") {
    await deps.failClaim(claim.id, intent.id);
    return { outcome: "declined", paymentIntentIds: seenIntents, changeApplications };
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
  };
  if (options?.settlePaymentOnly) {
    return {
      outcome: "ready_to_change",
      paymentIntentIds: seenIntents,
      changeApplications,
    };
  }
  return finishChange(settledClaim);
}
