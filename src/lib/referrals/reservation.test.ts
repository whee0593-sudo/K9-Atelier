import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyReservationRelease,
  canAutoReleaseReservation,
  evaluateStripeRelease,
  requireReleaseReason,
} from "./reservation";

describe("referral reservation release", () => {
  it("releases a reserved Collect hold after timeout when no PaymentIntent exists", () => {
    assert.equal(
      canAutoReleaseReservation({
        status: "reserved",
        stripePaymentIntentId: null,
        chargeIsPaid: false,
        expiresAt: "2026-08-30T01:00:00.000Z",
        now: new Date("2026-08-30T01:31:00.000Z"),
      }),
      true,
    );
  });

  it("does not restore released credit a second time", () => {
    const first = applyReservationRelease({
      status: "reserved",
      amountCents: 2500,
      balanceEffectCents: -2500,
    });
    assert.equal(first.changed, true);
    assert.equal(first.status, "released");
    assert.equal(first.amountCents, 2500);
    assert.equal(first.balanceEffectCents, -2500);
    assert.equal(first.reversalEffectCents, 2500);
    const second = applyReservationRelease({
      status: "released",
      amountCents: 2500,
      balanceEffectCents: -2500,
    });
    assert.equal(second.changed, false);
    assert.equal(second.amountCents, 2500);
    assert.equal(second.balanceEffectCents, -2500);
  });

  it("does not release a confirmed debit", () => {
    const result = applyReservationRelease({
      status: "confirmed",
      amountCents: 2500,
      balanceEffectCents: -2500,
    });
    assert.equal(result.changed, false);
    assert.equal(result.reason, "confirmed_debit");
    assert.equal(result.balanceEffectCents, -2500);
  });

  it("forbids release when the PaymentIntent succeeded", () => {
    assert.equal(evaluateStripeRelease("succeeded").action, "complete_payment");
  });

  it("marks processing PaymentIntents under review", () => {
    assert.equal(evaluateStripeRelease("processing").action, "under_review");
  });

  it("does not auto-release a PaymentIntent that still requires action", () => {
    assert.equal(
      canAutoReleaseReservation({
        status: "reserved",
        stripePaymentIntentId: "pi_123",
        chargeIsPaid: false,
        expiresAt: "2026-08-30T01:00:00.000Z",
        now: new Date("2026-08-30T03:00:00.000Z"),
      }),
      false,
    );
    assert.equal(evaluateStripeRelease("requires_action").action, "continue_payment");
  });

  it("allows release after the PaymentIntent is canceled", () => {
    assert.equal(evaluateStripeRelease("canceled").action, "release");
  });

  it("does not release when Stripe lookup fails", () => {
    assert.equal(evaluateStripeRelease("lookup_failed").action, "lookup_failed");
  });

  it("requires an admin reason before a manual release", () => {
    assert.equal(requireReleaseReason(""), false);
    assert.equal(requireReleaseReason("   "), false);
    assert.equal(requireReleaseReason("Collect page closed before payment"), true);
  });

  it("records a release as a status change for the audit log", () => {
    const released = applyReservationRelease({
      status: "reserved",
      amountCents: 1000,
      balanceEffectCents: -1000,
    });
    const audit = {
      action: "release_reservation",
      previousValue: { status: "reserved" },
      newValue: { status: released.status },
      reason: "Collect page closed before payment",
    };
    assert.equal(audit.action, "release_reservation");
    assert.equal(audit.newValue.status, "released");
    assert.equal(audit.reason.length > 0, true);
  });
});
