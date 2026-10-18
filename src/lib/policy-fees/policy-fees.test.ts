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
import {
  buildChangeRecoveryPayload,
  resumeAppointmentChange,
  type RecoveryClaim,
} from "@/lib/policy-fees/change-recovery";
import { executePolicyFee, nextPolicyFeeStep } from "@/lib/policy-fees/execute";
import type {
  PolicyClaimSnapshot,
  PolicyFeeExecutorDeps,
  PolicyPaymentState,
} from "@/lib/policy-fees/execute";
import { noShowPaymentNotice } from "@/lib/policy-fees/stripe-lookup";

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
      paymentState: "none",
      stripeSubmittedAt: null,
      ...overrides,
    };
  }

  function store(options?: {
    initial?: Partial<PolicyClaimSnapshot>;
    stripeStatus?: string;
    search?: "found" | "none" | "unavailable";
    expireIdempotency?: boolean;
    failSave?: boolean;
  }) {
    const current = claim(options?.initial);
    const ledger = new Map<string, { id: string; status: string }>();
    let creates = 0;
    let applications = 0;
    let fails = 0;
    let chain = Promise.resolve();
    const lock = <T>(run: () => Promise<T> | T) => {
      const next = chain.then(run, run);
      chain = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    };
    const deps: PolicyFeeExecutorDeps = {
      loadClaim: async () => ({ ...current }),
      reserveStripeSubmit: (claimId) =>
        lock(async () => {
          if (current.id !== claimId) return { outcome: "reconcile" as const };
          if (current.stripePaymentIntentId) {
            return { outcome: "known" as const, paymentIntentId: current.stripePaymentIntentId };
          }
          if (current.paymentState === "none" && !current.stripeSubmittedAt) {
            current.paymentState = "submitting";
            current.stripeSubmittedAt = "2026-10-18T18:00:00.000Z";
            return { outcome: "submit" as const, idempotencyKey: current.stripeIdempotencyKey };
          }
          return { outcome: "reconcile" as const };
        }),
      createPaymentIntent: async (input) => {
        if (options?.expireIdempotency && ledger.has(input.idempotencyKey)) {
          creates += 1;
          return { id: `pi_late_${creates}`, status: "succeeded" };
        }
        const existing = ledger.get(input.idempotencyKey);
        if (existing) return existing;
        creates += 1;
        const created = {
          id: "pi_once",
          status: options?.stripeStatus ?? "succeeded",
        };
        ledger.set(input.idempotencyKey, created);
        return created;
      },
      retrievePaymentIntent: async (id) => ({
        id,
        status: ledger.get(current.stripeIdempotencyKey)?.status ?? options?.stripeStatus ?? "succeeded",
      }),
      searchPaymentIntents: async () => {
        if (options?.search === "none") return { outcome: "none" as const };
        if (options?.search === "unavailable") return { outcome: "unavailable" as const };
        const found = ledger.get(current.stripeIdempotencyKey);
        return found
          ? { outcome: "found" as const, intent: found }
          : { outcome: "none" as const };
      },
      recordPayment: async (_claimId, paymentIntentId, state) => {
        if (options?.failSave) throw new Error("database write failed");
        current.stripePaymentIntentId = paymentIntentId;
        current.paymentState = state;
      },
      markUnknown: async () => {
        if (current.paymentState === "succeeded") return;
        current.paymentState = "unknown";
        current.status = "charging";
      },
      recordCharge: async () => {
        current.chargeId = current.chargeId ?? "chg-1";
        return { chargeId: current.chargeId };
      },
      completeClaim: async () => {
        current.status = "charged";
        current.paymentState = "succeeded";
      },
      failClaim: async () => {
        if (current.paymentState !== "failed" && current.paymentState !== "canceled") {
          throw new Error("unconfirmed");
        }
        fails += 1;
        current.status = "failed";
      },
      claimAppointmentChange: () =>
        lock(async () => {
          if (current.appointmentChangeApplied) return "already" as const;
          if (current.paymentState === "succeeded" && current.status !== "charged") {
            return "busy" as const;
          }
          if ((current as PolicyClaimSnapshot & { changeStarted?: boolean }).changeStarted) {
            return "busy" as const;
          }
          (current as PolicyClaimSnapshot & { changeStarted?: boolean }).changeStarted = true;
          return "apply" as const;
        }),
      applyAppointmentChange: async () => {
        applications += 1;
      },
      markChangeApplied: async () => {
        current.appointmentChangeApplied = true;
        return true;
      },
    };
    return {
      current,
      deps,
      counts: () => ({ creates, applications, fails }),
      setStatus(status: string) {
        const intent = ledger.get(current.stripeIdempotencyKey);
        if (intent) intent.status = status;
        options = { ...options, stripeStatus: status };
      },
    };
  }

  it("saves a succeeded PaymentIntent after the id write failed, including after the idempotency window", async () => {
    const world = store({ failSave: true });
    await assert.rejects(() => executePolicyFee(world.deps), /database write failed/);
    assert.equal(world.counts().creates, 1);
    assert.equal(world.current.paymentState, "submitting");
    assert.equal(world.current.stripePaymentIntentId, null);
    world.deps.recordPayment = async (_claimId, paymentIntentId, state) => {
      world.current.stripePaymentIntentId = paymentIntentId;
      world.current.paymentState = state;
    };
    const create = world.deps.createPaymentIntent;
    world.deps.createPaymentIntent = async (input) => {
      const late = await create({ ...input, idempotencyKey: `${input.idempotencyKey}:expired` });
      return { id: `pi_second_${late.id}`, status: "succeeded" };
    };
    const recovered = await executePolicyFee(world.deps);
    assert.equal(recovered.outcome, "change_applied");
    assert.equal(recovered.paymentIntentIds[0], "pi_once");
    assert.equal(world.counts().creates, 1);
    assert.equal(world.counts().applications, 1);
    const again = await executePolicyFee(world.deps);
    assert.equal(again.outcome, "settled");
    assert.equal(world.counts().creates, 1);
    assert.equal(world.counts().applications, 1);
  });

  it("does not create a PaymentIntent when Stripe search is empty or unavailable", async () => {
    for (const search of ["none", "unavailable"] as const) {
      const world = store({
        search,
        initial: {
          paymentState: "submitting",
          stripeSubmittedAt: "2026-10-17T18:00:00.000Z",
        },
      });
      const result = await executePolicyFee(world.deps);
      assert.equal(result.outcome, "needs_review");
      assert.equal(world.counts().creates, 0);
      assert.equal(world.current.paymentState, "unknown");
      assert.equal(world.current.status, "charging");
      assert.equal(world.counts().fails, 0);
      assert.equal(
        nextPolicyFeeStep(world.current).type,
        "reconcile",
      );
    }
  });

  it("recovers one PaymentIntent when the same claim is resumed concurrently and after a restart", async () => {
    const world = store({
      initial: {
        paymentState: "submitting",
        stripeSubmittedAt: "2026-10-17T18:00:00.000Z",
      },
    });
    world.deps.createPaymentIntent = async () => {
      throw new Error("must not create");
    };
    const seeded = { id: "pi_once", status: "succeeded" };
    world.deps.searchPaymentIntents = async () => ({ outcome: "found", intent: seeded });
    world.deps.retrievePaymentIntent = async (id) => ({ id, status: "succeeded" });
    const [first, second] = await Promise.all([
      executePolicyFee(world.deps),
      executePolicyFee(world.deps),
    ]);
    assert.equal(first.changeApplications + second.changeApplications, 1);
    assert.equal(world.counts().applications, 1);
    for (const outcome of [first.outcome, second.outcome]) {
      assert.ok(
        outcome === "change_applied" || outcome === "change_pending" || outcome === "settled",
      );
    }
    const restarted = await executePolicyFee(world.deps);
    assert.equal(restarted.outcome, "settled");
    assert.equal(world.counts().applications, 1);
    assert.equal(world.current.chargeId, "chg-1");
  });

  it("keeps a no-show card waiting, then records success, failure, or cancellation without a second charge", async () => {
    const waiting = store({ stripeStatus: "requires_action" });
    const pending = await executePolicyFee(waiting.deps, { settlePaymentOnly: true });
    assert.equal(pending.outcome, "in_progress");
    assert.equal(waiting.current.paymentState, "awaiting_customer");
    assert.equal(waiting.counts().creates, 1);
    assert.equal(waiting.counts().fails, 0);
    const stillWaiting = await executePolicyFee(waiting.deps, { settlePaymentOnly: true });
    assert.equal(stillWaiting.outcome, "in_progress");
    assert.equal(waiting.counts().creates, 1);
    assert.match(noShowPaymentNotice("awaiting_customer") ?? "", /Do not charge again/);
    assert.match(noShowPaymentNotice("unknown") ?? "", /manual check/);

    waiting.setStatus("succeeded");
    const paid = await executePolicyFee(waiting.deps, { settlePaymentOnly: true });
    assert.equal(paid.outcome, "ready_to_change");
    assert.equal(waiting.counts().creates, 1);
    assert.equal(waiting.current.status, "charged");

    const declined = store({ stripeStatus: "requires_payment_method" });
    assert.equal((await executePolicyFee(declined.deps)).outcome, "declined");
    assert.equal(declined.current.status, "failed");
    assert.equal(declined.counts().creates, 1);

    const canceled = store({ stripeStatus: "canceled" });
    assert.equal((await executePolicyFee(canceled.deps)).outcome, "declined");
    assert.equal(canceled.current.paymentState, "canceled");
    assert.equal(canceled.counts().fails, 1);

    const saved = store();
    const normal = await executePolicyFee(saved.deps, { settlePaymentOnly: true });
    assert.equal(normal.outcome, "ready_to_change");
    assert.equal(saved.current.appointmentChangeApplied, false);
    assert.equal(saved.counts().creates, 1);
    const repeat = await executePolicyFee(saved.deps);
    assert.equal(repeat.changeApplications, 1);
    assert.equal((await executePolicyFee(saved.deps)).outcome, "settled");
    assert.equal(saved.counts().creates, 1);
    assert.equal(saved.counts().applications, 1);
  });

  it("does not choose a new card create after Stripe has been asked", () => {
    const asked: PolicyPaymentState[] = [
      "submitting",
      "awaiting_customer",
      "processing",
      "unknown",
      "succeeded",
    ];
    for (const paymentState of asked) {
      assert.notEqual(
        nextPolicyFeeStep(
          claim({
            paymentState,
            stripeSubmittedAt: "2026-10-17T18:00:00.000Z",
            status: paymentState === "succeeded" ? "charged" : "charging",
          }),
        ).type,
        "create_intent",
      );
    }
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
    const sql = [
      readFileSync("supabase/migrations/20261018190000_policy_fee_controls.sql", "utf8"),
      readFileSync("supabase/migrations/20261018210000_policy_fee_payment_recovery.sql", "utf8"),
      readFileSync("supabase/migrations/20261018220000_policy_fee_change_recovery.sql", "utf8"),
    ].join("\n");
    assert.equal(/\bUPDATE\s+public\.appointment_charges\b/i.test(sql), false);
    assert.match(sql, /claim_id IS NULL/);
    assert.match(sql, /mark_policy_fee_payment_unknown/);
  });
});

describe("appointment change recovery", () => {
  function payload(action: "cancel" | "reschedule" | "remove_dog" = "cancel") {
    return buildChangeRecoveryPayload({
      operationId: "op-1",
      action,
      visitId: "visit-1",
      confirmedFee: 18,
      rows: [
        {
          id: "apt-1",
          status: "confirmed",
          appointment_date: "2026-10-20",
          scheduled_start: 540,
          appointment_time: "9:00 AM",
          time_preference: "morning",
          visit_sequence: 1,
        },
      ],
      rescheduleTo: action === "reschedule" ? { date: "2026-10-22", slotStartMinutes: 600 } : null,
    });
  }

  function world(options?: {
    phase?: RecoveryClaim["phase"];
    calendarWritten?: boolean;
    paymentState?: RecoveryClaim["paymentState"];
    status?: RecoveryClaim["status"];
    liveStatus?: string;
  }) {
    const saved = payload();
    const state: RecoveryClaim = {
      id: "claim-1",
      status: options?.status ?? "charged",
      paymentState: options?.paymentState ?? "succeeded",
      phase: options?.phase ?? "pending",
      calendarWritten: options?.calendarWritten ?? false,
      applied: false,
      action: "cancel",
      chargedAmount: 18,
      idempotencyKey: "op-1",
      visitId: "visit-1",
      payload: saved,
    };
    const live = {
      id: "apt-1",
      status: options?.liveStatus ?? "confirmed",
      appointmentDate: "2026-10-20",
      scheduledStart: 540,
    };
    let writes = 0;
    let marks = 0;
    let notices = 0;
    let releases = 0;
    let charges = 0;
    let chain = Promise.resolve();
    const lock = <T>(run: () => Promise<T> | T) => {
      const next = chain.then(run, run);
      chain = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    };
    return {
      counts: () => ({ writes, marks, notices, releases, charges }),
      resume: () =>
        resumeAppointmentChange({
          load: async () => ({ ...state, payload: saved }),
          acquire: () =>
            lock(async () => {
              charges += 0;
              if (state.applied || state.phase === "applied") return "already" as const;
              if (state.phase === "review") return "review" as const;
              if (state.status !== "charged") return "not_ready" as const;
              if (state.calendarWritten) return "resume" as const;
              if (state.phase === "applying") return "busy" as const;
              state.phase = "applying";
              return "apply" as const;
            }),
          release: async () => {
            releases += 1;
          },
          loadLive: async () => [{ ...live }],
          apply: (plan) =>
            lock(async () => {
              if (plan) charges += 0;
              if (state.phase !== "applying") return "not_acquired" as const;
              if (state.calendarWritten) return "already_written" as const;
              if (live.status !== "confirmed") {
                state.phase = "review";
                return "review" as const;
              }
              writes += 1;
              state.calendarWritten = true;
              live.status = "cancelled";
              return "written" as const;
            }),
          mark: () =>
            lock(async () => {
              if (!state.calendarWritten) return "not_written" as const;
              if (state.applied) return "already_applied" as const;
              state.applied = true;
              state.phase = "applied";
              marks += 1;
              return "applied" as const;
            }),
          afterWrite: async () => {
            notices += 1;
          },
        }),
    };
  }

  it("finishes one unpaid-again change after each interrupt and does not repeat it", async () => {
    const beforeLease = world();
    const first = await beforeLease.resume();
    assert.equal(first.outcome, "applied");
    assert.equal(first.outcome === "applied" && first.wrote, true);
    assert.deepEqual(beforeLease.counts(), { writes: 1, marks: 1, notices: 1, releases: 0, charges: 0 });
    const again = await beforeLease.resume();
    assert.equal(again.outcome, "already");
    assert.equal(beforeLease.counts().writes, 1);
    assert.equal(beforeLease.counts().notices, 1);

    const afterLease = world({ phase: "applying" });
    assert.equal((await afterLease.resume()).outcome, "not_ready");
    assert.equal(afterLease.counts().writes, 0);

    const afterWrite = world({ phase: "applying", calendarWritten: true });
    const marked = await afterWrite.resume();
    assert.equal(marked.outcome, "applied");
    assert.equal(marked.outcome === "applied" && marked.wrote, false);
    assert.equal(afterWrite.counts().writes, 0);
    assert.equal(afterWrite.counts().notices, 0);
    assert.equal(afterWrite.counts().marks, 1);

    const conflict = world({ liveStatus: "completed" });
    assert.equal((await conflict.resume()).outcome, "review");
    assert.equal(conflict.counts().writes, 0);
    assert.equal(conflict.counts().notices, 0);

    const unknown = world({ status: "charging", paymentState: "unknown" });
    assert.equal((await unknown.resume()).outcome, "payment_locked");
    assert.equal(unknown.counts().releases, 0);
    assert.equal(unknown.counts().writes, 0);
  });
});
