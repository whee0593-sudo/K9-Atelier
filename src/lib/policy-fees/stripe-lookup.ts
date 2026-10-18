import type Stripe from "stripe";
import type { PolicySearchResult } from "@/lib/policy-fees/execute";

export function policyFeeStripeMetadata(input: {
  claimId: string;
  idempotencyKey: string;
  appointmentId: string;
  kind: string;
}) {
  return {
    appointment_id: input.appointmentId,
    claim_id: input.claimId,
    policy_idempotency_key: input.idempotencyKey,
    kind: input.kind,
  };
}

export async function searchStripePolicyPayment(
  stripe: Stripe,
  claimId: string,
  idempotencyKey: string,
): Promise<PolicySearchResult> {
  if (claimId.includes("'") || idempotencyKey.includes("'")) {
    return { outcome: "unavailable" };
  }
  try {
    const result = await stripe.paymentIntents.search({
      query: `metadata['claim_id']:'${claimId}' AND metadata['policy_idempotency_key']:'${idempotencyKey}'`,
      limit: 2,
    });
    const matches = result.data.filter(
      (intent) =>
        intent.metadata?.claim_id === claimId &&
        intent.metadata?.policy_idempotency_key === idempotencyKey,
    );
    if (matches.length === 1) {
      const intent = matches[0]!;
      return { outcome: "found", intent: { id: intent.id, status: intent.status } };
    }
    if (matches.length === 0) return { outcome: "none" };
    return { outcome: "ambiguous" };
  } catch (error) {
    console.error("policy fee Stripe search failed:", error);
    return { outcome: "unavailable" };
  }
}

export function noShowPaymentNotice(state: string | null) {
  if (state === "awaiting_customer") {
    return "This card is waiting for the customer. Do not charge again. Check the payment after the customer finishes. The no-show evidence stays confirmed.";
  }
  if (state === "processing" || state === "submitting") {
    return "This card payment is still with Stripe. Do not charge again.";
  }
  if (state === "unknown") {
    return "This payment needs a manual check. A new charge stays blocked until Stripe shows a definite result.";
  }
  return null;
}

export function openCardPayment(state: string | null) {
  return (
    state === "submitting" ||
    state === "awaiting_customer" ||
    state === "processing" ||
    state === "unknown"
  );
}
