import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { applyFixedCollectCap, formatFixedCapPreview } from "@/lib/policy-fees/amounts";
import {
  coverageAfterEvent,
  legacyChargeNeedsReview,
  policyFeeFromRows,
} from "@/lib/policy-fees/coverage";
import { policyFeeIdempotencyKey } from "@/lib/policy-fees/keys";
import {
  noShowBusinessInputToInstant,
  noShowConfirmDecision,
  noShowInstantToBusinessInput,
} from "@/lib/policy-fees/no-show-evidence";
import { executePolicyFee, nextPolicyFeeStep } from "@/lib/policy-fees/execute";
import type { PolicyClaimSnapshot } from "@/lib/policy-fees/execute";

describe("fixed dollar cap", () => {
  it("does not waive when the cap is above the computed fee", () => {
    const priced = applyFixedCollectCap(10, 20);
    assert.equal(priced.ok, true);
    if (!priced.ok) return;
    assert.equal(priced.charged, 10);
    assert.equal(priced.waiver, 0);
    const preview = formatFixedCapPreview({ computed: 10, collectCap: 20 });
    assert.equal(preview?.heading, "Fixed dollar cap");
    assert.match(preview?.note ?? "", /not a percentage/i);
    assert.equal(preview?.chargedLabel, "$10.00");
    assert.equal(preview?.waiverLabel, "$0.00");
  });

  it("charges the cap when it is lower than the computed fee", () => {
    const priced = applyFixedCollectCap(10, 4);
    assert.equal(priced.ok, true);
    if (!priced.ok) return;
    assert.equal(priced.charged, 4);
    assert.equal(priced.waiver, 6);
  });
});

describe("policy fee coverage", () => {
  const daisy = {
    id: "daisy",
    service_price: 90,
    estimated_total: 90,
    travel_fee: 13,
    add_on_ids: [],
  };
  const milo = {
    id: "milo",
    service_price: 110,
    estimated_total: 110,
    travel_fee: 13,
    add_on_ids: [],
  };

  it("lets a second removed dog be charged and keeps travel for the visit", () => {
    const first = policyFeeFromRows({
      action: "remove_dog",
      rows: [daisy],
      coverage: { appointmentIds: [], travel: false },
      band: "same_day",
    });
    assert.equal(first.ok && first.computed, 90);
    const second = policyFeeFromRows({
      action: "remove_dog",
      rows: [milo],
      coverage: { appointmentIds: ["daisy"], travel: false },
      band: "same_day",
    });
    assert.equal(second.ok && second.computed, 110);
    assert.equal(second.ok && second.includesTravel, false);
  });

  it("charges a later no-show only for the uncovered dog and one travel fee", () => {
    const noShow = policyFeeFromRows({
      action: "no_show",
      rows: [milo],
      coverage: { appointmentIds: ["daisy"], travel: false },
      band: "same_day",
    });
    assert.equal(noShow.ok && noShow.computed, 123);
    assert.equal(noShow.ok && noShow.forfeit, true);
  });

  it("does not let a reschedule occupy forfeiture coverage", () => {
    const reschedule = policyFeeFromRows({
      action: "reschedule",
      rows: [daisy, milo],
      coverage: { appointmentIds: [], travel: false },
      band: "late",
    });
    assert.equal(reschedule.ok && reschedule.forfeit, false);
    assert.equal(reschedule.ok && reschedule.computed, 106.5);
  });

  it("keeps coverage after a normal refund and releases it only for failure or an explicit reopen", () => {
    assert.equal(coverageAfterEvent("refund_completed"), "keep");
    assert.equal(coverageAfterEvent("waiver_consumed"), "keep");
    assert.equal(coverageAfterEvent("charge_failed"), "release");
    assert.equal(coverageAfterEvent("admin_reopen"), "release");
    assert.equal(
      legacyChargeNeedsReview({
        kind: "cancellation",
        status: "paid",
        claimId: null,
        reviewed: false,
      }),
      true,
    );
    assert.equal(
      legacyChargeNeedsReview({
        kind: "cancellation",
        status: "paid",
        claimId: null,
        reviewed: true,
      }),
      false,
    );
  });
});

describe("idempotency keys", () => {
  it("gives each removed dog and each reschedule its own key", () => {
    const daisy = policyFeeIdempotencyKey({
      action: "remove_dog",
      visitId: "visit",
      appointmentId: "daisy",
    });
    const milo = policyFeeIdempotencyKey({
      action: "remove_dog",
      visitId: "visit",
      appointmentId: "milo",
    });
    assert.notEqual(daisy, milo);
    const firstMove = policyFeeIdempotencyKey({
      action: "reschedule",
      visitId: "visit",
      fromDate: "2026-10-20",
      fromSlot: 540,
      toDate: "2026-10-22",
      toSlot: 600,
    });
    const secondMove = policyFeeIdempotencyKey({
      action: "reschedule",
      visitId: "visit",
      fromDate: "2026-10-22",
      fromSlot: 600,
      toDate: "2026-10-27",
      toSlot: 540,
    });
    assert.notEqual(firstMove, secondMove);
  });
});

describe("no-show confirmation", () => {
  const arrived = "2026-10-18T14:00:00.000Z";
  const contact = "2026-10-18T14:05:00.000Z";

  it("waits 15 minutes from the contact attempt", () => {
    assert.equal(
      noShowConfirmDecision({
        arrivedAt: arrived,
        contactAttemptedAt: contact,
        customerReplied: false,
        handoffArranged: false,
        now: new Date("2026-10-18T14:19:00.000Z"),
      }).ok,
      false,
    );
    assert.equal(
      noShowConfirmDecision({
        arrivedAt: arrived,
        contactAttemptedAt: contact,
        customerReplied: false,
        handoffArranged: false,
        now: new Date("2026-10-18T14:20:00.000Z"),
      }).ok,
      true,
    );
  });

  it("rejects a reply or a handoff", () => {
    assert.equal(
      noShowConfirmDecision({
        arrivedAt: arrived,
        contactAttemptedAt: contact,
        customerReplied: true,
        handoffArranged: false,
        now: new Date("2026-10-18T14:30:00.000Z"),
      }).reason,
      "customer_replied",
    );
  });
});

describe("stripe recovery", () => {
  function claim(overrides: Partial<PolicyClaimSnapshot> = {}): PolicyClaimSnapshot {
    return {
      id: "claim-1",
      status: "charging",
      chargedAmount: 25,
      stripeIdempotencyKey: "claim-1:1",
      stripePaymentIntentId: null,
      appointmentChangeApplied: false,
      chargeId: null,
      tender: "card",
      ...overrides,
    };
  }

  it("reuses one PaymentIntent when the database write fails, then applies the change once", async () => {
    const intents = new Map<string, { id: string; status: string }>();
    let creates = 0;
    let applications = 0;
    let applied = false;
    let failSave = true;
    const current = claim();
    const deps = {
      loadClaim: async () => ({ ...current, appointmentChangeApplied: applied }),
      createPaymentIntent: async (input: { idempotencyKey: string }) => {
        const existing = intents.get(input.idempotencyKey);
        if (existing) return existing;
        creates += 1;
        const created = { id: "pi_once", status: "succeeded" };
        intents.set(input.idempotencyKey, created);
        return created;
      },
      retrievePaymentIntent: async (id: string) => ({ id, status: "succeeded" }),
      savePaymentIntentId: async (_claimId: string, paymentIntentId: string) => {
        if (failSave) throw new Error("database write failed");
        current.stripePaymentIntentId = paymentIntentId;
      },
      recordCharge: async () => {
        current.chargeId = "chg-1";
        return { chargeId: "chg-1" };
      },
      completeClaim: async () => {
        current.status = "charged";
      },
      failClaim: async () => {
        current.status = "failed";
      },
      applyAppointmentChange: async () => {
        applications += 1;
      },
      markChangeApplied: async () => {
        applied = true;
        return true;
      },
    };
    await assert.rejects(
      () => executePolicyFee(deps, { settlePaymentOnly: true }),
      /database write failed/,
    );
    assert.equal(creates, 1);
    assert.equal(current.status, "charging");
    failSave = false;
    const recovered = await executePolicyFee(deps, { settlePaymentOnly: true });
    assert.equal(recovered.outcome, "ready_to_change");
    assert.equal(recovered.paymentIntentIds[0], "pi_once");
    assert.equal(creates, 1);
    const replay = await executePolicyFee(deps, { settlePaymentOnly: true });
    assert.equal(replay.outcome, "ready_to_change");
    assert.equal(creates, 1);
    const changed = await executePolicyFee(deps);
    const again = await executePolicyFee(deps);
    assert.equal(changed.changeApplications, 1);
    assert.equal(again.outcome, "settled");
    assert.equal(applications, 1);
    assert.equal(
      nextPolicyFeeStep(claim({ status: "charged", appointmentChangeApplied: true })).type,
      "done",
    );
  });
});

describe("eastern no-show times", () => {
  it("stores an Eastern wall clock as the matching instant", () => {
    assert.equal(
      noShowBusinessInputToInstant("2026-10-18T10:00"),
      "2026-10-18T14:00:00.000Z",
    );
    assert.equal(
      noShowBusinessInputToInstant("2026-01-18T10:00"),
      "2026-01-18T15:00:00.000Z",
    );
    assert.equal(
      noShowInstantToBusinessInput("2026-10-18T14:00:00.000Z"),
      "2026-10-18T10:00",
    );
  });
});

describe("migration safety", () => {
  it("does not rewrite historical charge amounts while creating tables", () => {
    const sql = readFileSync(
      "supabase/migrations/20261018190000_policy_fee_controls.sql",
      "utf8",
    );
    assert.equal(/\bUPDATE\s+public\.appointment_charges\b/i.test(sql), false);
    assert.match(sql, /claim_id IS NULL/);
  });
});
