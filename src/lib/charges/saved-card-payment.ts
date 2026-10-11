import type { ChargeKind, ChargeLineItem, ChargeTender } from "@/lib/charges/types";

/** Shown when Stripe returns an API or configuration error, never the raw Stripe text. */
export const SAVED_CARD_FRIENDLY_ERROR =
  "We couldn't complete this payment. Please try again.";

export const SAVED_CARD_DECLINE_MESSAGE = "This card could not be charged.";

export const SAVED_CARD_IN_PROGRESS_MESSAGE =
  "A payment is already in progress. Please wait a moment and try again.";

export const SAVED_CARD_ALREADY_PAID_MESSAGE =
  "This appointment is already paid.";

/** A pending charge with no PaymentIntent yet is still inside the first request. */
export const PENDING_INTENT_GRACE_MS = 30_000;

const TECHNICAL_STRIPE_TYPES = new Set([
  "StripeInvalidRequestError",
  "StripeAPIError",
  "StripeAuthenticationError",
  "StripePermissionError",
  "StripeRateLimitError",
  "StripeConnectionError",
  "StripeIdempotencyError",
  "invalid_request_error",
  "api_error",
  "authentication_error",
  "idempotency_error",
  "rate_limit_error",
  "api_connection_error",
]);

const TECHNICAL_STRIPE_TEXT =
  /return_url|automatic_payment_methods|allow_redirects|paymentintent|setupintent|payment_method_types|no such|resource_missing|\bapi key\b|sk_live|sk_test/i;

export type SavedCardPaymentIntentParams = {
  amount: number;
  currency: "usd";
  customer: string;
  payment_method: string;
  confirm: true;
  off_session: boolean;
  description: string;
  metadata: {
    appointment_id: string;
    charge_id: string;
    kind: string;
    visit_id?: string;
    customer_id?: string;
  };
  /**
   * Dashboard payment methods are on by default for this Stripe API version.
   * `allow_redirects: "never"` keeps the saved card on this page. Card
   * authentication (3D Secure) still returns `requires_action`.
   */
  automatic_payment_methods: {
    enabled: true;
    allow_redirects: "never";
  };
};

export type SavedCardAttemptInput = {
  appointmentId: string;
  kind: ChargeKind;
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipAmount: number;
  total: number;
  newClientDiscount: number;
  referralCreditApplied: number;
  creditCents: number;
  createdBy: string;
  paymentMethodId: string;
  amountCents: number;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  offSession: boolean;
  description: string;
  visitId?: string | null;
  customerId?: string | null;
  now?: number;
};

export type PaymentIntentSnapshot = {
  id: string;
  status: string;
  client_secret: string | null;
};

export type AttemptCharge = {
  id: string;
  appointmentId: string;
  kind: ChargeKind;
  status: "pending" | "paid" | "failed";
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipAmount: number;
  total: number;
  newClientDiscount: number;
  referralCreditApplied: number;
  paymentMethodId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  receiptChannel: "sms" | "email" | null;
  paidAt: string | null;
  refundedAmount: number;
  tender: ChargeTender;
};

export type SavedCardAttemptResult<TCharge extends AttemptCharge> =
  | {
      ok: true;
      charge: TCharge;
      clientSecret?: string;
      requiresAction?: boolean;
    }
  | {
      ok: false;
      error: "conflict" | "declined" | "server";
      message: string;
      stripeError?: unknown;
    };

export function savedCardPaymentIntentParams(input: {
  amountCents: number;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  offSession: boolean;
  description: string;
  appointmentId: string;
  chargeId: string;
  kind: string;
  visitId?: string | null;
  customerId?: string | null;
}): SavedCardPaymentIntentParams {
  return {
    amount: input.amountCents,
    currency: "usd",
    customer: input.stripeCustomerId,
    payment_method: input.stripePaymentMethodId,
    confirm: true,
    off_session: input.offSession,
    description: input.description,
    metadata: {
      appointment_id: input.appointmentId,
      charge_id: input.chargeId,
      kind: input.kind,
      ...(input.visitId ? { visit_id: input.visitId } : {}),
      ...(input.customerId ? { customer_id: input.customerId } : {}),
    },
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  };
}

export function savedCardIdempotencyKey(chargeId: string) {
  return `k9-saved-card:${chargeId}`;
}

export function savedCardChargeInsert(input: SavedCardAttemptInput) {
  return {
    appointment_id: input.appointmentId,
    kind: input.kind,
    status: "pending" as const,
    line_items: input.lineItems,
    subtotal: input.subtotal,
    tip_amount: input.tipAmount,
    total: input.total,
    new_client_discount: input.newClientDiscount,
    referral_credit_applied: input.referralCreditApplied,
    created_by: input.createdBy,
    payment_method_id: input.paymentMethodId,
    tender: "card" as const,
  };
}

export function savedCardIntentLink(paymentIntentId: string) {
  return { stripe_payment_intent_id: paymentIntentId };
}

export function savedCardPaidPatch(paymentMethodId: string, paidAt: string) {
  return {
    status: "paid" as const,
    paid_at: paidAt,
    payment_method_id: paymentMethodId,
  };
}

export function classifyNewSavedCardIntent(
  status: string,
): "paid" | "action_required" | "declined" {
  if (status === "succeeded") return "paid";
  if (status === "requires_action" || status === "requires_confirmation") {
    return "action_required";
  }
  return "declined";
}

export function classifyExistingSavedCardIntent(
  status: string,
): "paid" | "action_required" | "in_progress" | "replace" {
  if (status === "succeeded") return "paid";
  if (status === "requires_action" || status === "requires_confirmation") {
    return "action_required";
  }
  if (status === "processing") return "in_progress";
  return "replace";
}

export function pendingWithoutIntentAction(
  createdAt: string,
  now: number,
): "in_progress" | "resume" {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created) || now - created < PENDING_INTENT_GRACE_MS) {
    return "in_progress";
  }
  return "resume";
}

export function sanitizeCustomerPaymentError(
  message: string | undefined,
  fallback: string,
) {
  if (!message?.trim()) return fallback;
  if (TECHNICAL_STRIPE_TEXT.test(message)) return SAVED_CARD_FRIENDLY_ERROR;
  return message;
}

export function customerFacingStripeMessage(error: unknown) {
  if (typeof error === "string") {
    return sanitizeCustomerPaymentError(error, SAVED_CARD_DECLINE_MESSAGE);
  }
  if (!error || typeof error !== "object") return SAVED_CARD_DECLINE_MESSAGE;
  const record = error as { type?: unknown; rawType?: unknown; message?: unknown };
  const type = typeof record.type === "string" ? record.type : "";
  const rawType = typeof record.rawType === "string" ? record.rawType : "";
  const message = typeof record.message === "string" ? record.message : "";
  if (
    TECHNICAL_STRIPE_TYPES.has(type) ||
    TECHNICAL_STRIPE_TYPES.has(rawType) ||
    TECHNICAL_STRIPE_TEXT.test(message)
  ) {
    return SAVED_CARD_FRIENDLY_ERROR;
  }
  if (
    (type === "card_error" ||
      type === "StripeCardError" ||
      rawType === "card_error" ||
      type === "validation_error") &&
    message &&
    !TECHNICAL_STRIPE_TEXT.test(message)
  ) {
    return message;
  }
  return SAVED_CARD_DECLINE_MESSAGE;
}

export function acquirePaymentSubmission(state: { current: boolean }) {
  if (state.current) return false;
  state.current = true;
  return true;
}

export function releasePaymentSubmission(state: { current: boolean }) {
  state.current = false;
}

export type SavedCardChargeDeps<TCharge extends AttemptCharge> = {
  findPaid: () => Promise<TCharge | null>;
  findLatestPending: () => Promise<TCharge | null>;
  insertPending: (
    row: ReturnType<typeof savedCardChargeInsert>,
  ) => Promise<TCharge>;
  linkPaymentIntent: (chargeId: string, paymentIntentId: string) => Promise<void>;
  markPaid: (chargeId: string, paymentMethodId: string) => Promise<TCharge | null>;
  /** Marks the charge failed and releases a reserved referral credit, if any. */
  markFailed: (chargeId: string) => Promise<void>;
  reserveCredit: (
    chargeId: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  createPaymentIntent: (
    params: SavedCardPaymentIntentParams,
    options: { idempotencyKey: string },
  ) => Promise<PaymentIntentSnapshot>;
  retrievePaymentIntent: (id: string) => Promise<PaymentIntentSnapshot>;
};

export async function attemptSavedCardCharge<TCharge extends AttemptCharge>(
  input: SavedCardAttemptInput,
  deps: SavedCardChargeDeps<TCharge>,
): Promise<SavedCardAttemptResult<TCharge>> {
  try {
    return await runSavedCardAttempt(input, deps);
  } catch (error) {
    return {
      ok: false,
      error: "server",
      message: SAVED_CARD_FRIENDLY_ERROR,
      stripeError: error,
    };
  }
}

async function runSavedCardAttempt<TCharge extends AttemptCharge>(
  input: SavedCardAttemptInput,
  deps: SavedCardChargeDeps<TCharge>,
): Promise<SavedCardAttemptResult<TCharge>> {
  const now = input.now ?? Date.now();
  const paid = await deps.findPaid();
  if (paid) {
    return { ok: false, error: "conflict", message: SAVED_CARD_ALREADY_PAID_MESSAGE };
  }

  const pending = await deps.findLatestPending();
  let charge: TCharge | null = null;

  if (pending) {
    if (!pending.stripePaymentIntentId) {
      if (pendingWithoutIntentAction(pending.createdAt, now) === "in_progress") {
        return {
          ok: false,
          error: "conflict",
          message: SAVED_CARD_IN_PROGRESS_MESSAGE,
        };
      }
      charge = pending;
    } else {
      const intent = await deps.retrievePaymentIntent(pending.stripePaymentIntentId);
      const existing = classifyExistingSavedCardIntent(intent.status);
      if (existing === "paid") {
        const paidCharge = await deps.markPaid(
          pending.id,
          pending.paymentMethodId ?? input.paymentMethodId,
        );
        if (!paidCharge) {
          return { ok: false, error: "server", message: SAVED_CARD_FRIENDLY_ERROR };
        }
        return { ok: true, charge: paidCharge };
      }
      if (existing === "action_required") {
        if (!intent.client_secret) {
          return { ok: false, error: "server", message: SAVED_CARD_FRIENDLY_ERROR };
        }
        return {
          ok: true,
          charge: pending,
          clientSecret: intent.client_secret,
          requiresAction: true,
        };
      }
      if (existing === "in_progress") {
        return {
          ok: false,
          error: "conflict",
          message: SAVED_CARD_IN_PROGRESS_MESSAGE,
        };
      }
      await deps.markFailed(pending.id);
    }
  }

  if (!charge) {
    try {
      charge = await deps.insertPending(savedCardChargeInsert(input));
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code === "23505") {
        return {
          ok: false,
          error: "conflict",
          message: SAVED_CARD_IN_PROGRESS_MESSAGE,
        };
      }
      return { ok: false, error: "server", message: SAVED_CARD_FRIENDLY_ERROR };
    }
    if (input.creditCents > 0) {
      const reserved = await deps.reserveCredit(charge.id);
      if (!reserved.ok) {
        await deps.markFailed(charge.id);
        return { ok: false, error: "conflict", message: reserved.message };
      }
    }
  }

  let intent: PaymentIntentSnapshot;
  try {
    intent = await deps.createPaymentIntent(
      savedCardPaymentIntentParams({
        amountCents: input.amountCents,
        stripeCustomerId: input.stripeCustomerId,
        stripePaymentMethodId: input.stripePaymentMethodId,
        offSession: input.offSession,
        description: input.description,
        appointmentId: input.appointmentId,
        chargeId: charge.id,
        kind: input.kind,
        visitId: input.visitId,
        customerId: input.customerId,
      }),
      { idempotencyKey: savedCardIdempotencyKey(charge.id) },
    );
  } catch (error) {
    await deps.markFailed(charge.id);
    return {
      ok: false,
      error: "declined",
      message: customerFacingStripeMessage(error),
      stripeError: error,
    };
  }

  await deps.linkPaymentIntent(charge.id, intent.id);
  charge = { ...charge, stripePaymentIntentId: intent.id };

  const outcome = classifyNewSavedCardIntent(intent.status);
  if (outcome === "paid") {
    const paidCharge = await deps.markPaid(charge.id, input.paymentMethodId);
    if (!paidCharge) {
      return { ok: false, error: "server", message: SAVED_CARD_FRIENDLY_ERROR };
    }
    return { ok: true, charge: paidCharge };
  }
  if (outcome === "action_required") {
    if (!intent.client_secret) {
      return { ok: false, error: "server", message: SAVED_CARD_FRIENDLY_ERROR };
    }
    return {
      ok: true,
      charge,
      clientSecret: intent.client_secret,
      requiresAction: true,
    };
  }

  await deps.markFailed(charge.id);
  return { ok: false, error: "declined", message: SAVED_CARD_DECLINE_MESSAGE };
}
