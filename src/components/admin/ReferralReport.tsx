"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { centsToDollars } from "@/lib/referrals/eligible";
import { RELEASE_REASONS } from "@/lib/referrals/reservation";
import type { AdminReferralDashboard } from "@/lib/referrals/types";

function formatReferralMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(centsToDollars(cents));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function ReferralReport() {
  const [dashboard, setDashboard] = useState<AdminReferralDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/referrals", { credentials: "include" });
    const body = (await response.json()) as AdminReferralDashboard & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error ?? "Could not load referral records.");
    }
    setDashboard(body);
  }, []);

  useEffect(() => {
    void load().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load referral records.",
      );
    });
  }, [load]);

  async function postAction(body: Record<string, unknown>, id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Action failed.");
      setReason("");
      setAdjustAmount("");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (error && !dashboard) {
    return (
      <p className="rounded-2xl border border-lavender/30 bg-cream p-6 text-sm text-text-muted">
        {error}
      </p>
    );
  }
  if (!dashboard) {
    return <p className="text-sm text-text-muted">Loading referral records…</p>;
  }

  return (
    <section className="space-y-10">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Table title="Customer balances">
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Pending</Th>
            <Th>Available</Th>
            <Th>Used</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.balances, "No referral balances yet.")}
          {dashboard.balances.map((row) => (
            <tr key={row.customerId} className="border-t border-lavender/20">
              <Td>{row.customerName}</Td>
              <Td>{formatReferralMoney(row.pendingCents)}</Td>
              <Td>{formatReferralMoney(row.availableCents)}</Td>
              <Td>{formatReferralMoney(row.usedCents)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table title="Reserved credit">
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Reserved</Th>
            <Th>Appointment / charge</Th>
            <Th>Reserved at</Th>
            <Th>PaymentIntent</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.reservations ?? [], "No open credit reservations.")}
          {(dashboard.reservations ?? []).map((row) => (
            <tr key={row.id} className="border-t border-lavender/20">
              <Td>{row.customerName}</Td>
              <Td>{formatReferralMoney(row.amountCents)}</Td>
              <Td>
                {row.appointmentId ?? "—"}
                <span className="mt-1 block font-mono text-xs">
                  {row.chargeId ?? "—"}
                </span>
              </Td>
              <Td>{formatDate(row.reservedAt)}</Td>
              <Td>
                {row.hasPaymentIntent ? "Yes" : "No"}
                {row.stripeStatus ? ` · ${row.stripeStatus}` : ""}
              </Td>
              <Td>{row.status.replaceAll("_", " ")}</Td>
              <Td>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void postAction(
                        {
                          action: "release_reservation",
                          entryId: row.id,
                          reason,
                        },
                        row.id,
                      )
                    }
                    className="text-left text-sm underline"
                  >
                    Release Reservation
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void postAction(
                        {
                          action: "review_reservation",
                          entryId: row.id,
                          reason,
                        },
                        row.id,
                      )
                    }
                    className="text-left text-sm underline"
                  >
                    Review
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table title="Referral codes">
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Pet</Th>
            <Th>Code</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.codes, "No referral codes yet.")}
          {dashboard.codes.map((row) => (
            <tr key={row.id} className="border-t border-lavender/20">
              <Td>{row.customerName}</Td>
              <Td>{row.petName}</Td>
              <Td className="font-mono text-xs">{row.code}</Td>
              <Td>{row.active ? "Active" : "Inactive"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table title="Referral relationships">
        <thead>
          <tr>
            <Th>Referrer</Th>
            <Th>Referred</Th>
            <Th>Pet / code</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.relationships, "No referral relationships yet.")}
          {dashboard.relationships.map((row) => (
            <tr key={row.id} className="border-t border-lavender/20">
              <Td>{row.referrerName}</Td>
              <Td>{row.referredName}</Td>
              <Td>
                {row.petName}
                <span className="mt-1 block font-mono text-xs">{row.code}</span>
              </Td>
              <Td>
                {row.status.replaceAll("_", " ")}
                {row.reviewRequired ? " · review" : ""}
              </Td>
              <Td>
                {row.status === "under_review" || row.reviewRequired ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void postAction(
                          {
                            action: "approve_relationship",
                            relationshipId: row.id,
                            reason: reason || "Approved after household review.",
                          },
                          row.id,
                        )
                      }
                      className="text-left text-sm underline"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void postAction(
                          {
                            action: "cancel_relationship",
                            relationshipId: row.id,
                            reason: reason || "Cancelled after household review.",
                          },
                          row.id,
                        )
                      }
                      className="text-left text-sm underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  "—"
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table title="Reward sources">
        <thead>
          <tr>
            <Th>Referrer</Th>
            <Th>Referred / code</Th>
            <Th>Status</Th>
            <Th>Reward</Th>
            <Th>Remaining</Th>
            <Th>Issued</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.sources, "No referral rewards issued yet.")}
          {dashboard.sources.map((row) => (
            <tr key={row.id} className="border-t border-lavender/20">
              <Td>{row.referrerName}</Td>
              <Td>
                {row.referredName}
                <span className="mt-1 block font-mono text-xs">{row.code}</span>
              </Td>
              <Td>{row.status.replaceAll("_", " ")}</Td>
              <Td>{formatReferralMoney(row.rewardCents)}</Td>
              <Td>{formatReferralMoney(row.remainingCents)}</Td>
              <Td>{formatDate(row.issuedAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table title="Refunds and review">
        <thead>
          <tr>
            <Th>Referrer</Th>
            <Th>Status</Th>
            <Th>Remaining</Th>
            <Th>Adjust / cancel</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.review, "No rewards are under review.")}
          {dashboard.review.map((row) => (
            <tr key={row.id} className="border-t border-lavender/20">
              <Td>{row.referrerName}</Td>
              <Td>{row.status.replaceAll("_", " ")}</Td>
              <Td>{formatReferralMoney(row.remainingCents)}</Td>
              <Td>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={adjustAmount}
                    onChange={(event) => setAdjustAmount(event.target.value)}
                    placeholder="New remaining $"
                    className="w-36 rounded-lg border border-lavender/40 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void postAction(
                        {
                          action: "adjust",
                          sourceId: row.id,
                          remainingDollars: Number(adjustAmount),
                          reason,
                        },
                        row.id,
                      )
                    }
                    className="text-left text-sm underline"
                  >
                    Adjust remaining
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void postAction(
                        { action: "cancel", sourceId: row.id, reason },
                        row.id,
                      )
                    }
                    className="text-left text-sm underline"
                  >
                    Cancel reward
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <label className="block text-sm text-text-muted">
        Admin reason (required for release, review, and adjustments)
        <select
          value={RELEASE_REASONS.includes(reason as (typeof RELEASE_REASONS)[number]) ? reason : reason ? "Other" : ""}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="">Choose a reason</option>
          {RELEASE_REASONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
          rows={3}
          placeholder="Collect page closed before payment"
        />
      </label>

      <Table title="Admin adjustments">
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Customer</Th>
            <Th>Action</Th>
            <Th>Reason</Th>
          </tr>
        </thead>
        <tbody>
          {empty(dashboard.audit, "No admin adjustments yet.")}
          {dashboard.audit.map((row) => (
            <tr key={row.id} className="border-t border-lavender/20">
              <Td>{formatDate(row.createdAt)}</Td>
              <Td>{row.customerName}</Td>
              <Td>{row.action.replaceAll("_", " ")}</Td>
              <Td>{row.reason ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function Table({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-lg font-medium text-gold-dark">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-lavender/30">
        <table className="min-w-full text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium uppercase tracking-wide text-text-muted">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function empty(rows: unknown[], message: string) {
  if (rows.length > 0) return null;
  return (
    <tr>
      <td className="px-4 py-6 text-sm text-text-muted" colSpan={8}>
        {message}
      </td>
    </tr>
  );
}
