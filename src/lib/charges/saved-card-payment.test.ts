import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChargeLineItem } from "@/lib/charges/types";
import { quoteReferralApplication } from "@/lib/referrals/eligible";
import { centsToDollars } from "@/lib/referrals/eligible";
import {
  PENDING_INTENT_GRACE_MS,
  SAVED_CARD_ALREADY_PAID_MESSAGE,
  SAVED_CARD_FRIENDLY_ERROR,
  SAVED_CARD_IN_PROGRESS_MESSAGE,
  acquirePaymentSubmission,
  attemptSavedCardCharge,
  customerFacingStripeMessage,
  releasePaymentSubmission,
  savedCardIdempotencyKey,
  savedCardPaymentIntentParams,
  type AttemptCharge,
  type PaymentIntentSnapshot,
  type SavedCardAttemptInput,
  type SavedCardChargeDeps,
  type SavedCardPaymentIntentParams,
} from "@/lib/charges/saved-card-payment";

const STRIPE_REDIRECT_ERROR =
  "This PaymentIntent is configured to accept payment methods enabled in your Dashboard. Because some of these payment methods might redirect your customer off of your page, you must provide a `return_url`. If you don't want to accept redirect-based payment methods, set `automatic_payment_methods[enabled]` to `true` and `automatic_payment_methods[allow_redirects]` to `never` when creating Setup Intents and Payment Intents.";

const serviceLine: ChargeLineItem = {
  id: "line-1",
  label: "Signature Bath & Care",
  amount: 100,
  referralCategory: "eligible_service",
};

function input(overrides: Partial<SavedCardAttemptInput> = {}): SavedCardAttemptInput {
  return {
    appointmentId: "apt-1",
    kind: "service",
    lineItems: [serviceLine],
    subtotal: 100,
    tipAmount: 0,
    total: 100,
    newClientDiscount: 0,
    referralCreditApplied: 0,
    creditCents: 0,
    createdBy: "staff-1",
    paymentMethodId: "pm-local-1",
    amountCents: 10000,
    stripeCustomerId: "cus_existing",
    stripePaymentMethodId: "pm_saved_card",
    offSession: false,
    description: "K9 Atelier grooming · Mochi",
    now: Date.parse("2026-10-07T15:00:00.000Z"),
    ...overrides,
  };
}

function charge(overrides: Partial<AttemptCharge> = {}): AttemptCharge {
  const base = input();
  return {
    id: "chg-1",
    appointmentId: base.appointmentId,
    kind: "service",
    status: "pending",
    lineItems: base.lineItems,
    subtotal: base.subtotal,
    tipAmount: base.tipAmount,
    total: base.total,
    newClientDiscount: 0,
    referralCreditApplied: 0,
    paymentMethodId: base.paymentMethodId,
    stripePaymentIntentId: null,
    createdAt: "2026-10-07T15:00:00.000Z",
    receiptChannel: null,
    paidAt: null,
    refundedAmount: 0,
    tender: "card",
    ...overrides,
  };
}

type Memory = {
  charges: AttemptCharge[];
  creates: Array<{
    params: SavedCardPaymentIntentParams;
    idempotencyKey: string;
  }>;
  intents: Map<string, PaymentIntentSnapshot>;
  reserved: string[];
  released: string[];
};

function memoryDeps(
  state: Memory,
  handlers?: {
    createPaymentIntent?: SavedCardChargeDeps<AttemptCharge>["createPaymentIntent"];
    retrievePaymentIntent?: SavedCardChargeDeps<AttemptCharge>["retrievePaymentIntent"];
  },
): SavedCardChargeDeps<AttemptCharge> {
  return {
    async findPaid() {
      return (
        state.charges.find(
          (row) => row.status === "paid" && row.appointmentId === "apt-1",
        ) ?? null
      );
    },
    async findLatestPending() {
      const pending = state.charges.filter((row) => row.status === "pending");
      return pending[pending.length - 1] ?? null;
    },
    async insertPending(row) {
      const next = charge({
        id: `chg-${state.charges.length + 1}`,
        subtotal: row.subtotal,
        tipAmount: row.tip_amount,
        total: row.total,
        newClientDiscount: row.new_client_discount,
        referralCreditApplied: row.referral_credit_applied,
        paymentMethodId: row.payment_method_id,
        lineItems: row.line_items,
        createdAt: new Date(input().now ?? Date.now()).toISOString(),
      });
      state.charges.push(next);
      return next;
    },
    async linkPaymentIntent(chargeId, paymentIntentId) {
      const row = state.charges.find((item) => item.id === chargeId);
      if (row) row.stripePaymentIntentId = paymentIntentId;
    },
    async markPaid(chargeId, paymentMethodId) {
      const row = state.charges.find((item) => item.id === chargeId);
      if (!row) return null;
      row.status = "paid";
      row.paidAt = "2026-10-07T15:00:02.000Z";
      row.paymentMethodId = paymentMethodId;
      return { ...row };
    },
    async markFailed(chargeId) {
      const row = state.charges.find((item) => item.id === chargeId);
      if (row && row.status !== "paid") row.status = "failed";
      state.released.push(chargeId);
    },
    async reserveCredit(chargeId) {
      state.reserved.push(chargeId);
      return { ok: true };
    },
    async createPaymentIntent(params, options) {
      state.creates.push({ params, idempotencyKey: options.idempotencyKey });
      if (handlers?.createPaymentIntent) {
        return handlers.createPaymentIntent(params, options);
      }
      const existing = [...state.intents.values()].find((intent) =>
        state.creates.filter((create) => create.idempotencyKey === options.idempotencyKey)
          .length > 1 &&
        intent.id === `pi_${options.idempotencyKey}`,
      );
      if (existing) return existing;
      const created: PaymentIntentSnapshot = {
        id: `pi_${options.idempotencyKey}`,
        status: "succeeded",
        client_secret: `secret_${options.idempotencyKey}`,
      };
      state.intents.set(created.id, created);
      return created;
    },
    async retrievePaymentIntent(id) {
      if (handlers?.retrievePaymentIntent) return handlers.retrievePaymentIntent(id);
      const found = state.intents.get(id);
      if (!found) throw new Error(`missing ${id}`);
      return found;
    },
  };
}

describe("saved card Today's Bill checkout", () => {
  it("charges a saved card on the page without redirect payment methods", async () => {
    const state: Memory = {
      charges: [],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    const result = await attemptSavedCardCharge(input(), memoryDeps(state));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const params = state.creates[0]?.params;
    assert.equal(state.creates.length, 1);
    assert.deepEqual(params?.automatic_payment_methods, {
      enabled: true,
      allow_redirects: "never",
    });
    assert.equal(params?.payment_method, "pm_saved_card");
    assert.equal(params?.customer, "cus_existing");
    assert.equal(params?.confirm, true);
    assert.equal(params?.off_session, false);
    assert.equal(params?.amount, 10000);
    assert.equal("return_url" in (params ?? {}), false);
    assert.equal("error_on_requires_action" in (params ?? {}), false);
    assert.equal("setup_future_usage" in (params ?? {}), false);
    assert.equal(result.charge.status, "paid");
    assert.equal(result.charge.paymentMethodId, "pm-local-1");
    assert.equal(result.charge.stripePaymentIntentId?.startsWith("pi_"), true);
    assert.equal(result.charge.paidAt, "2026-10-07T15:00:02.000Z");
    assert.equal(result.charge.total, 100);
    assert.equal(result.charge.tipAmount, 0);
    assert.equal(state.charges.filter((row) => row.status === "paid").length, 1);
  });

  it("includes the tip in the saved-card amount and payment record", async () => {
    const quote = quoteReferralApplication({
      lineItems: [serviceLine],
      tipAmount: 18,
      availableCreditCents: 0,
      mode: "none",
      applyNewClientDiscount: false,
    });
    const state: Memory = {
      charges: [],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    const result = await attemptSavedCardCharge(
      input({
        tipAmount: 18,
        total: centsToDollars(quote.dueCents),
        amountCents: quote.dueCents,
      }),
      memoryDeps(state),
    );
    assert.equal(result.ok, true);
    assert.equal(state.creates[0]?.params.amount, 11800);
    assert.equal(state.charges[0]?.tipAmount, 18);
    assert.equal(state.charges[0]?.total, 118);
    assert.equal(state.charges[0]?.status, "paid");
    assert.equal(state.charges[0]?.paymentMethodId, "pm-local-1");
  });

  it("charges the amount left after referral credit and records the credit", async () => {
    const quote = quoteReferralApplication({
      lineItems: [serviceLine],
      tipAmount: 0,
      availableCreditCents: 1500,
      mode: "full",
      applyNewClientDiscount: false,
    });
    const state: Memory = {
      charges: [],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    const result = await attemptSavedCardCharge(
      input({
        total: centsToDollars(quote.dueCents),
        amountCents: quote.dueCents,
        referralCreditApplied: centsToDollars(quote.creditCents),
        creditCents: quote.creditCents,
      }),
      memoryDeps(state),
    );
    assert.equal(result.ok, true);
    assert.equal(quote.creditCents, 1500);
    assert.equal(state.creates[0]?.params.amount, 8500);
    assert.equal(state.charges[0]?.referralCreditApplied, 15);
    assert.equal(state.charges[0]?.total, 85);
    assert.equal(state.charges[0]?.status, "paid");
    assert.deepEqual(state.reserved, [state.charges[0]?.id]);
    assert.equal(state.released.length, 0);
  });

  it("returns the client secret when the saved card needs authentication", async () => {
    const state: Memory = {
      charges: [],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    const result = await attemptSavedCardCharge(
      input(),
      memoryDeps(state, {
        async createPaymentIntent(params, options) {
          state.creates.push({ params, idempotencyKey: options.idempotencyKey });
          const created: PaymentIntentSnapshot = {
            id: "pi_auth",
            status: "requires_action",
            client_secret: "pi_auth_secret",
          };
          state.intents.set(created.id, created);
          return created;
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.requiresAction, true);
    assert.equal(result.clientSecret, "pi_auth_secret");
    assert.equal(result.charge.status, "pending");
    assert.equal(result.charge.stripePaymentIntentId, "pi_auth");
    assert.equal(state.charges[0]?.status, "pending");
    assert.equal(state.charges[0]?.paidAt, null);
    assert.equal(state.creates[0]?.params.off_session, false);
    assert.equal(state.creates[0]?.params.automatic_payment_methods.allow_redirects, "never");
    assert.equal(state.released.length, 0);
  });

  it("hides a Stripe configuration error and keeps the raw error for logs", async () => {
    const state: Memory = {
      charges: [],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    const stripeError = {
      type: "StripeInvalidRequestError",
      rawType: "invalid_request_error",
      message: STRIPE_REDIRECT_ERROR,
      requestId: "req_test",
    };
    const result = await attemptSavedCardCharge(
      input(),
      memoryDeps(state, {
        async createPaymentIntent() {
          state.creates.push({
            params: savedCardPaymentIntentParams({
              amountCents: 10000,
              stripeCustomerId: "cus_existing",
              stripePaymentMethodId: "pm_saved_card",
              offSession: false,
              description: "K9 Atelier grooming · Mochi",
              appointmentId: "apt-1",
              chargeId: "chg-1",
              kind: "service",
            }),
            idempotencyKey: "unused",
          });
          throw stripeError;
        },
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "declined");
    assert.equal(result.message, SAVED_CARD_FRIENDLY_ERROR);
    assert.equal(result.message.includes("return_url"), false);
    assert.equal(result.message.includes("automatic_payment_methods"), false);
    assert.equal(result.stripeError, stripeError);
    assert.equal(state.charges[0]?.status, "failed");
    assert.equal(state.charges.filter((row) => row.status === "paid").length, 0);
    assert.equal(
      customerFacingStripeMessage(stripeError),
      SAVED_CARD_FRIENDLY_ERROR,
    );
    assert.equal(
      customerFacingStripeMessage(STRIPE_REDIRECT_ERROR),
      SAVED_CARD_FRIENDLY_ERROR,
    );
    assert.equal(
      customerFacingStripeMessage({
        type: "validation_error",
        message: "Your card number is incomplete.",
      }),
      "Your card number is incomplete.",
    );
    assert.equal(
      customerFacingStripeMessage({
        type: "card_error",
        message: "Your card has insufficient funds.",
      }),
      "Your card has insufficient funds.",
    );
  });

  it("does not create a second PaymentIntent when checkout is submitted twice", async () => {
    const state: Memory = {
      charges: [],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    let releaseFirst: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let createCalls = 0;
    const deps = memoryDeps(state, {
      async createPaymentIntent(params, options) {
        createCalls += 1;
        state.creates.push({ params, idempotencyKey: options.idempotencyKey });
        if (createCalls === 1) await gate;
        const created: PaymentIntentSnapshot = {
          id: "pi_once",
          status: "succeeded",
          client_secret: "secret_once",
        };
        state.intents.set(created.id, created);
        return created;
      },
    });

    const first = attemptSavedCardCharge(input(), deps);
    await waitUntil(() => state.charges.length === 1);
    const second = await attemptSavedCardCharge(input(), deps);
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.message, SAVED_CARD_IN_PROGRESS_MESSAGE);
    assert.equal(createCalls, 1);

    releaseFirst();
    const finished = await first;
    assert.equal(finished.ok, true);
    if (!finished.ok) return;
    assert.equal(finished.charge.status, "paid");
    assert.equal(createCalls, 1);
    assert.equal(state.charges.filter((row) => row.status === "paid").length, 1);
    assert.equal(state.charges.length, 1);

    const duplicateAfterPaid = await attemptSavedCardCharge(input(), deps);
    assert.equal(duplicateAfterPaid.ok, false);
    if (duplicateAfterPaid.ok) return;
    assert.equal(duplicateAfterPaid.message, SAVED_CARD_ALREADY_PAID_MESSAGE);
    assert.equal(createCalls, 1);
  });

  it("reuses a saved-card PaymentIntent that already succeeded", async () => {
    const state: Memory = {
      charges: [
        charge({
          stripePaymentIntentId: "pi_existing",
          createdAt: "2026-10-07T14:00:00.000Z",
        }),
      ],
      creates: [],
      intents: new Map([
        [
          "pi_existing",
          { id: "pi_existing", status: "succeeded", client_secret: "secret" },
        ],
      ]),
      reserved: [],
      released: [],
    };
    const result = await attemptSavedCardCharge(input(), memoryDeps(state));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.charge.status, "paid");
    assert.equal(result.charge.paymentMethodId, "pm-local-1");
    assert.equal(result.charge.stripePaymentIntentId, "pi_existing");
    assert.equal(state.creates.length, 0);
  });

  it("resumes the same charge id when a PaymentIntent response was lost", async () => {
    const state: Memory = {
      charges: [
        charge({
          id: "chg-stuck",
          stripePaymentIntentId: null,
          createdAt: new Date(
            Date.parse("2026-10-07T15:00:00.000Z") - PENDING_INTENT_GRACE_MS - 1000,
          ).toISOString(),
        }),
      ],
      creates: [],
      intents: new Map(),
      reserved: [],
      released: [],
    };
    const seen = new Map<string, PaymentIntentSnapshot>();
    const result = await attemptSavedCardCharge(
      input(),
      memoryDeps(state, {
        async createPaymentIntent(params, options) {
          state.creates.push({ params, idempotencyKey: options.idempotencyKey });
          const previous = seen.get(options.idempotencyKey);
          if (previous) return previous;
          const created: PaymentIntentSnapshot = {
            id: "pi_resumed",
            status: "succeeded",
            client_secret: "secret",
          };
          seen.set(options.idempotencyKey, created);
          return created;
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(state.charges.length, 1);
    assert.equal(state.charges[0]?.id, "chg-stuck");
    assert.equal(state.creates[0]?.idempotencyKey, savedCardIdempotencyKey("chg-stuck"));
    assert.equal(state.charges[0]?.status, "paid");
    assert.equal(state.charges[0]?.stripePaymentIntentId, "pi_resumed");
  });

  it("ignores a second click while the first checkout is still running", () => {
    const lock = { current: false };
    assert.equal(acquirePaymentSubmission(lock), true);
    assert.equal(acquirePaymentSubmission(lock), false);
    releasePaymentSubmission(lock);
    assert.equal(acquirePaymentSubmission(lock), true);
  });
});

async function waitUntil(ready: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out waiting for the saved-card charge");
}
