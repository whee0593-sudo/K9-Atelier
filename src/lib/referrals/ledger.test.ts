import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEDGER_STATUS_SOURCE,
  availableLedgerCents,
  buildReleaseAuditPayload,
  canReverseDebit,
  existingReversal,
  netEffectForDebitPair,
  planDebitReversal,
  releasePreservesOriginalAmount,
  type LedgerEntry,
} from "./ledger";

function debit(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "debit-1",
    entryType: "debit",
    status: "reserved",
    amountCents: 2500,
    balanceEffectCents: -2500,
    ...overrides,
  };
}

describe("referral credit ledger", () => {
  it("uses status as the only reservation source of truth", () => {
    assert.equal(LEDGER_STATUS_SOURCE, "status");
    const row = debit();
    assert.equal("reservationStatus" in row, false);
    assert.equal(row.status, "reserved");
  });

  it("does not clear the original debit amounts on release", () => {
    const original = debit();
    const planned = planDebitReversal({
      debit: original,
      entries: [original],
      nextStatus: "released",
      reason: "Collect page closed before payment",
      reversalId: "rev-1",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(releasePreservesOriginalAmount(original, planned.debit), true);
    assert.equal(planned.debit.amountCents, 2500);
    assert.equal(planned.debit.balanceEffectCents, -2500);
    assert.equal(planned.debit.status, "released");
  });

  it("adds one matching reversal for a released debit", () => {
    const original = debit();
    const planned = planDebitReversal({
      debit: original,
      entries: [original],
      nextStatus: "released",
      reason: "PaymentIntent cancelled",
      reversalId: "rev-1",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.reversal.entryType, "reversal");
    assert.equal(planned.reversal.amountCents, original.amountCents);
    assert.equal(planned.reversal.balanceEffectCents, 2500);
    assert.equal(planned.reversal.relatedLedgerEntryId, original.id);
  });

  it("does not create a second valid reversal for the same debit", () => {
    const original = debit();
    const first = planDebitReversal({
      debit: original,
      entries: [original],
      nextStatus: "released",
      reason: "Manual correction",
      reversalId: "rev-1",
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = planDebitReversal({
      debit: first.debit,
      entries: first.entries,
      nextStatus: "released",
      reason: "Manual correction",
      reversalId: "rev-2",
    });
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.reason, "not_open");
    assert.equal(existingReversal(first.entries, original.id)?.id, "rev-1");
    assert.equal(
      first.entries.filter((row) => row.entryType === "reversal").length,
      1,
    );

    const stillReserved = debit({ id: "debit-2" });
    const duplicate = planDebitReversal({
      debit: stillReserved,
      entries: [
        stillReserved,
        {
          id: "rev-existing",
          entryType: "reversal",
          status: "confirmed",
          amountCents: 2500,
          balanceEffectCents: 2500,
          relatedLedgerEntryId: stillReserved.id,
        },
      ],
      nextStatus: "released",
      reason: "Manual correction",
      reversalId: "rev-duplicate",
    });
    assert.equal(duplicate.ok, false);
    if (duplicate.ok) return;
    assert.equal(duplicate.reason, "already_reversed");
  });

  it("does not restore available credit again on a repeated release", () => {
    const credit: LedgerEntry = {
      id: "credit-1",
      entryType: "credit",
      status: "confirmed",
      amountCents: 10000,
      balanceEffectCents: 10000,
    };
    const original = debit();
    const before = availableLedgerCents([credit, original]);
    assert.equal(before, 7500);

    const first = planDebitReversal({
      debit: original,
      entries: [credit, original],
      nextStatus: "released",
      reason: "Collect page closed before payment",
      reversalId: "rev-1",
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const afterFirst = availableLedgerCents(first.entries);
    assert.equal(afterFirst, 10000);

    const second = planDebitReversal({
      debit: first.debit,
      entries: first.entries,
      nextStatus: "released",
      reason: "Collect page closed before payment",
      reversalId: "rev-2",
    });
    assert.equal(second.ok, false);
    assert.equal(availableLedgerCents(first.entries), afterFirst);
  });

  it("nets the original debit and its reversal to zero", () => {
    const original = debit({ amountCents: 1800, balanceEffectCents: -1800 });
    const planned = planDebitReversal({
      debit: original,
      entries: [original],
      nextStatus: "released",
      reason: "Duplicate reservation",
      reversalId: "rev-1",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(netEffectForDebitPair(planned.debit, planned.reversal), 0);
    assert.equal(availableLedgerCents(planned.entries), 0);
  });

  it("does not reverse a confirmed debit", () => {
    const confirmed = debit({ status: "confirmed" });
    assert.equal(canReverseDebit(confirmed), false);
    const planned = planDebitReversal({
      debit: confirmed,
      entries: [confirmed],
      nextStatus: "released",
      reason: "Manual correction",
      reversalId: "rev-1",
    });
    assert.equal(planned.ok, false);
    if (planned.ok) return;
    assert.equal(planned.reason, "confirmed_debit");
    assert.equal(availableLedgerCents([confirmed]), -2500);
  });

  it("keeps under_review holds on the available balance until release", () => {
    const credit: LedgerEntry = {
      id: "credit-1",
      entryType: "credit",
      status: "confirmed",
      amountCents: 5000,
      balanceEffectCents: 5000,
    };
    const review = debit({ status: "under_review" });
    assert.equal(canReverseDebit(review), true);
    assert.equal(availableLedgerCents([credit, review]), 2500);
  });

  it("records the original debit and reversal on the audit payload", () => {
    const original = debit();
    const planned = planDebitReversal({
      debit: original,
      entries: [original],
      nextStatus: "released",
      reason: "Collect page closed before payment",
      reversalId: "rev-1",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    const audit = buildReleaseAuditPayload({
      debitId: planned.debit.id,
      reversalId: planned.reversal.id,
      previousStatus: original.status,
      nextStatus: "released",
      reason: "Collect page closed before payment",
      adminUserId: "admin-1",
      stripeStatus: "canceled",
    });
    assert.equal(audit.action, "release_reservation");
    assert.equal(audit.ledgerEntryId, original.id);
    assert.equal(audit.adminUserId, "admin-1");
    assert.equal(audit.previousValue.debitId, original.id);
    assert.equal(audit.newValue.debitId, original.id);
    assert.equal(audit.newValue.reversalId, "rev-1");
    assert.equal(audit.newValue.stripeStatus, "canceled");
    assert.equal(audit.reason.length > 0, true);
  });
});
