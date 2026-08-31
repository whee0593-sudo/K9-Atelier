export const RESERVATION_TTL_MS = 30 * 60 * 1000;

export const RELEASE_REASONS = [
  "Collect page closed before payment",
  "PaymentIntent cancelled",
  "Payment failed",
  "Duplicate reservation",
  "Manual correction",
  "Other",
] as const;

export type ReservationStatus =
  | "reserved"
  | "confirmed"
  | "released"
  | "reversed"
  | "under_review";

export type StripeReleaseDecision =
  | { action: "complete_payment"; message: string }
  | { action: "under_review"; message: string }
  | { action: "continue_payment"; message: string }
  | { action: "cancel_then_release"; message: string }
  | { action: "release"; message: string }
  | { action: "lookup_failed"; message: string };

export function reservationExpiresAt(from = new Date()) {
  return new Date(from.getTime() + RESERVATION_TTL_MS).toISOString();
}

export function reservationHoldsBalance(status: string) {
  return status === "reserved" || status === "confirmed" || status === "under_review";
}

export function canAutoReleaseReservation(input: {
  status: string;
  stripePaymentIntentId?: string | null;
  chargeIsPaid?: boolean;
  expiresAt?: string | null;
  now?: Date;
}) {
  if (input.status !== "reserved") return false;
  if (input.stripePaymentIntentId) return false;
  if (input.chargeIsPaid) return false;
  if (!input.expiresAt) return false;
  const now = input.now ?? new Date();
  return now.getTime() >= new Date(input.expiresAt).getTime();
}

export function evaluateStripeRelease(
  status: string | null | "lookup_failed",
): StripeReleaseDecision {
  if (status === "lookup_failed") {
    return {
      action: "lookup_failed",
      message: "Stripe could not be queried. This reservation is under review.",
    };
  }
  if (!status) {
    return {
      action: "release",
      message: "No PaymentIntent is attached to this reservation.",
    };
  }
  switch (status) {
    case "succeeded":
      return {
        action: "complete_payment",
        message: "This payment already succeeded and cannot be released.",
      };
    case "processing":
      return {
        action: "under_review",
        message: "This payment is still processing.",
      };
    case "requires_action":
    case "requires_confirmation":
      return {
        action: "continue_payment",
        message:
          "This payment still needs customer action. Return to Collect to finish it.",
      };
    case "requires_payment_method":
      return {
        action: "cancel_then_release",
        message: "This payment attempt can be cancelled and the credit released.",
      };
    case "canceled":
    case "cancelled":
      return {
        action: "release",
        message: "This PaymentIntent is cancelled.",
      };
    default:
      return {
        action: "under_review",
        message: `Unexpected PaymentIntent status: ${status}`,
      };
  }
}

export function requireReleaseReason(reason: string) {
  return Boolean(reason.trim());
}

export function applyReservationRelease(input: {
  status: string;
  amountCents: number;
  balanceEffectCents: number;
}) {
  if (input.status === "confirmed") {
    return {
      changed: false,
      status: input.status,
      amountCents: input.amountCents,
      balanceEffectCents: input.balanceEffectCents,
      reason: "confirmed_debit" as const,
    };
  }
  if (input.status === "released" || input.status === "reversed") {
    return {
      changed: false,
      status: input.status,
      amountCents: input.amountCents,
      balanceEffectCents: input.balanceEffectCents,
      reason: "already_closed" as const,
    };
  }
  if (input.status !== "reserved" && input.status !== "under_review") {
    return {
      changed: false,
      status: input.status,
      amountCents: input.amountCents,
      balanceEffectCents: input.balanceEffectCents,
      reason: "not_open" as const,
    };
  }
  return {
    changed: true,
    status: "released" as const,
    amountCents: input.amountCents,
    balanceEffectCents: input.balanceEffectCents,
    reversalAmountCents: input.amountCents,
    reversalEffectCents: -input.balanceEffectCents,
  };
}
