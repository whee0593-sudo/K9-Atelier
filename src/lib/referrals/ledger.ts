import type { ReservationStatus } from "@/lib/referrals/reservation";

export type LedgerEntryType = "credit" | "debit" | "adjustment" | "reversal";

export type LedgerEntry = {
  id: string;
  entryType: LedgerEntryType;
  status: ReservationStatus;
  amountCents: number;
  balanceEffectCents: number;
  relatedLedgerEntryId?: string | null;
  releaseReason?: string | null;
};

export const LEDGER_STATUS_SOURCE = "status" as const;

export function availableLedgerCents(entries: LedgerEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.balanceEffectCents, 0);
}

export function canReverseDebit(entry: LedgerEntry) {
  return (
    entry.entryType === "debit" &&
    (entry.status === "reserved" || entry.status === "under_review")
  );
}

export function existingReversal(
  entries: LedgerEntry[],
  debitId: string,
) {
  return entries.find(
    (entry) =>
      entry.entryType === "reversal" && entry.relatedLedgerEntryId === debitId,
  );
}

export function planDebitReversal(input: {
  debit: LedgerEntry;
  entries: LedgerEntry[];
  nextStatus: "released" | "reversed";
  reason: string;
  reversalId: string;
}) {
  if (input.debit.status === "confirmed") {
    return { ok: false as const, reason: "confirmed_debit" };
  }
  if (!canReverseDebit(input.debit)) {
    return { ok: false as const, reason: "not_open" };
  }
  if (existingReversal(input.entries, input.debit.id)) {
    return { ok: false as const, reason: "already_reversed", changed: false };
  }

  const debit: LedgerEntry = {
    ...input.debit,
    status: input.nextStatus,
    releaseReason: input.reason,
  };
  const reversal: LedgerEntry = {
    id: input.reversalId,
    entryType: "reversal",
    status: "confirmed",
    amountCents: input.debit.amountCents,
    balanceEffectCents: -input.debit.balanceEffectCents,
    relatedLedgerEntryId: input.debit.id,
    releaseReason: input.reason,
  };
  return {
    ok: true as const,
    debit,
    reversal,
    entries: [...input.entries.filter((row) => row.id !== input.debit.id), debit, reversal],
  };
}

export function releasePreservesOriginalAmount(before: LedgerEntry, after: LedgerEntry) {
  return (
    before.amountCents === after.amountCents &&
    before.balanceEffectCents === after.balanceEffectCents
  );
}

export function netEffectForDebitPair(debit: LedgerEntry, reversal?: LedgerEntry | null) {
  return debit.balanceEffectCents + (reversal?.balanceEffectCents ?? 0);
}

export function buildReleaseAuditPayload(input: {
  debitId: string;
  reversalId: string;
  previousStatus: string;
  nextStatus: "released" | "reversed";
  reason: string;
  adminUserId?: string;
  stripeStatus?: string | null;
}) {
  return {
    action:
      input.nextStatus === "reversed" ? "reverse_reservation" : "release_reservation",
    ledgerEntryId: input.debitId,
    reason: input.reason,
    adminUserId: input.adminUserId ?? null,
    previousValue: { status: input.previousStatus, debitId: input.debitId },
    newValue: {
      status: input.nextStatus,
      debitId: input.debitId,
      reversalId: input.reversalId,
      stripeStatus: input.stripeStatus ?? null,
    },
  };
}
