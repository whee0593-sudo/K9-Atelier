import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import {
  markReservationUnderReview,
  releaseExpiredReferralReservations,
  releaseLedgerReservation,
  writeReferralAudit,
} from "@/lib/referrals/service";
import { evaluateStripeRelease, requireReleaseReason } from "@/lib/referrals/reservation";
import { confirmAppointmentCharge } from "@/lib/charges/service";
import { getStripe } from "@/lib/stripe/server";
import type {
  AdminReferralAuditRow,
  AdminReferralBalanceRow,
  AdminReferralCodeRow,
  AdminReferralDashboard,
  AdminReferralRelationshipRow,
  AdminReferralReservationRow,
  AdminReferralSourceRow,
} from "@/lib/referrals/types";

export type {
  AdminReferralAuditRow,
  AdminReferralBalanceRow,
  AdminReferralCodeRow,
  AdminReferralDashboard,
  AdminReferralRelationshipRow,
  AdminReferralSourceRow,
} from "@/lib/referrals/types";

function displayName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return name || row.email || "Customer";
}

export async function getAdminReferralDashboard(): Promise<
  | { dashboard: AdminReferralDashboard }
  | { error: "unauthenticated" | "forbidden" | "misconfigured" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!hasSupabaseAdminConfig()) return { error: "misconfigured" };
  await releaseExpiredReferralReservations();

  const admin = createAdminClient();
  const [
    codesResult,
    petsResult,
    relationshipsResult,
    sourcesResult,
    ledgerResult,
    auditResult,
  ] = await Promise.all([
    admin
      .from("pet_referral_codes")
      .select("id, owner_customer_id, pet_id, referral_code, is_active")
      .order("created_at", { ascending: false }),
    admin.from("pets").select("id, name, customer_id").is("archived_at", null),
    admin
      .from("referral_relationships")
      .select(
        "id, status, review_required, created_at, referrer_customer_id, referred_customer_id, referral_code_id, referrer_pet_id",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("referral_reward_sources")
      .select(
        "id, status, reward_credit_cents, remaining_credit_cents, visit_key, issued_at, source_charge_id, referrer_customer_id, referred_customer_id, referral_relationship_id",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("referral_credit_ledger")
      .select(
        "id, customer_id, entry_type, amount_cents, balance_effect_cents, status, appointment_id, charge_id, stripe_payment_intent_id, reservation_expires_at, created_at",
      ),
    admin
      .from("referral_audit_log")
      .select("id, action, reason, created_at, customer_id")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (
    codesResult.error ||
    petsResult.error ||
    relationshipsResult.error ||
    sourcesResult.error ||
    ledgerResult.error ||
    auditResult.error
  ) {
    console.error(
      "getAdminReferralDashboard failed:",
      codesResult.error?.message,
      petsResult.error?.message,
      relationshipsResult.error?.message,
      sourcesResult.error?.message,
      ledgerResult.error?.message,
      auditResult.error?.message,
    );
    return { error: "server" };
  }

  const customerIds = new Set<string>();
  for (const row of codesResult.data ?? []) customerIds.add(row.owner_customer_id as string);
  for (const row of relationshipsResult.data ?? []) {
    customerIds.add(row.referrer_customer_id as string);
    customerIds.add(row.referred_customer_id as string);
  }
  for (const row of sourcesResult.data ?? []) {
    customerIds.add(row.referrer_customer_id as string);
    customerIds.add(row.referred_customer_id as string);
  }
  for (const row of ledgerResult.data ?? []) customerIds.add(row.customer_id as string);
  for (const row of auditResult.data ?? []) {
    if (row.customer_id) customerIds.add(row.customer_id as string);
  }

  const { data: profiles, error: profilesError } = customerIds.size
    ? await admin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", [...customerIds])
    : { data: [], error: null };
  if (profilesError) {
    console.error("getAdminReferralDashboard profiles failed:", profilesError.message);
    return { error: "server" };
  }

  const profileNames = new Map(
    (profiles ?? []).map((row) => [row.id as string, displayName(row)]),
  );
  const petNames = new Map(
    (petsResult.data ?? []).map((row) => [row.id as string, String(row.name ?? "Dog")]),
  );
  const codeById = new Map(
    (codesResult.data ?? []).map((row) => [
      row.id as string,
      {
        code: row.referral_code as string,
        petName: petNames.get(row.pet_id as string) ?? "Dog",
      },
    ]),
  );

  const codes: AdminReferralCodeRow[] = (codesResult.data ?? []).map((row) => ({
    id: row.id as string,
    customerId: row.owner_customer_id as string,
    customerName: profileNames.get(row.owner_customer_id as string) ?? "Customer",
    petName: petNames.get(row.pet_id as string) ?? "Dog",
    code: row.referral_code as string,
    active: Boolean(row.is_active),
  }));

  const relationships: AdminReferralRelationshipRow[] = (
    relationshipsResult.data ?? []
  ).map((row) => {
    const code = codeById.get(row.referral_code_id as string);
    return {
      id: row.id as string,
      referrerName: profileNames.get(row.referrer_customer_id as string) ?? "Customer",
      referredName: profileNames.get(row.referred_customer_id as string) ?? "Customer",
      petName: petNames.get(row.referrer_pet_id as string) ?? code?.petName ?? "Dog",
      code: code?.code ?? "",
      status: row.status as string,
      reviewRequired: Boolean(row.review_required),
      createdAt: row.created_at as string,
    };
  });

  const relById = new Map(relationships.map((row) => [row.id, row]));
  const sources: AdminReferralSourceRow[] = (sourcesResult.data ?? []).map((row) => {
    const rel = relById.get(row.referral_relationship_id as string);
    return {
      id: row.id as string,
      referrerName: profileNames.get(row.referrer_customer_id as string) ?? "Customer",
      referredName: profileNames.get(row.referred_customer_id as string) ?? "Customer",
      code: rel?.code ?? "",
      status: row.status as string,
      rewardCents: Number(row.reward_credit_cents),
      remainingCents: Number(row.remaining_credit_cents),
      visitKey: (row.visit_key as string | null) ?? null,
      issuedAt: (row.issued_at as string | null) ?? null,
      sourceChargeId: row.source_charge_id as string,
    };
  });

  const balances = new Map<string, AdminReferralBalanceRow>();
  for (const row of ledgerResult.data ?? []) {
    const customerId = row.customer_id as string;
    const current = balances.get(customerId) ?? {
      customerId,
      customerName: profileNames.get(customerId) ?? "Customer",
      pendingCents: 0,
      availableCents: 0,
      usedCents: 0,
    };
    if (row.status === "reserved" || row.status === "under_review") {
      current.pendingCents += Math.abs(Number(row.balance_effect_cents));
    }
    current.availableCents += Number(row.balance_effect_cents);
    if (row.entry_type === "debit" && row.status === "confirmed") {
      current.usedCents += Number(row.amount_cents);
    }
    balances.set(customerId, current);
  }

  return {
    dashboard: {
      balances: [...balances.values()].sort((a, b) =>
        a.customerName.localeCompare(b.customerName),
      ),
      codes,
      relationships,
      sources,
      review: sources.filter(
        (row) => row.status === "under_review" || row.status === "cancelled",
      ),
      reservations: (ledgerResult.data ?? [])
        .filter(
          (row) =>
            row.entry_type === "debit" &&
            (row.status === "reserved" || row.status === "under_review"),
        )
        .map((row) => ({
          id: row.id as string,
          customerId: row.customer_id as string,
          customerName: profileNames.get(row.customer_id as string) ?? "Customer",
          appointmentId: (row.appointment_id as string | null) ?? null,
          chargeId: (row.charge_id as string | null) ?? null,
          amountCents: Number(row.amount_cents),
          reservedAt: row.created_at as string,
          expiresAt: (row.reservation_expires_at as string | null) ?? null,
          hasPaymentIntent: Boolean(row.stripe_payment_intent_id),
          stripePaymentIntentId:
            (row.stripe_payment_intent_id as string | null) ?? null,
          stripeStatus: null,
          status: row.status as string,
        })) as AdminReferralReservationRow[],
      audit: (auditResult.data ?? []).map((row) => ({
        id: row.id as string,
        action: row.action as string,
        reason: (row.reason as string | null) ?? null,
        customerName: row.customer_id
          ? (profileNames.get(row.customer_id as string) ?? "Customer")
          : "—",
        createdAt: row.created_at as string,
      })),
    },
  };
}

export async function adminAdjustReferralReward(input: {
  sourceId: string;
  remainingDollars: number;
  reason: string;
}): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "conflict" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  const reason = input.reason.trim();
  if (!reason) return { error: "conflict" };
  if (!Number.isFinite(input.remainingDollars) || input.remainingDollars < 0) {
    return { error: "conflict" };
  }

  const admin = createAdminClient();
  const { data: source, error } = await admin
    .from("referral_reward_sources")
    .select(
      "id, referrer_customer_id, remaining_credit_cents, reward_credit_cents, status",
    )
    .eq("id", input.sourceId)
    .maybeSingle();
  if (error) return { error: "server" };
  if (!source) return { error: "not_found" };

  const nextRemaining = Math.round(input.remainingDollars * 100);
  const previousRemaining = Number(source.remaining_credit_cents);
  const delta = nextRemaining - previousRemaining;
  const now = new Date().toISOString();
  const nextStatus =
    nextRemaining <= 0
      ? source.status === "under_review"
        ? "under_review"
        : "redeemed"
      : nextRemaining < Number(source.reward_credit_cents)
        ? "partially_used"
        : "available";

  const { error: updateError } = await admin
    .from("referral_reward_sources")
    .update({
      remaining_credit_cents: nextRemaining,
      status: nextStatus,
      updated_at: now,
    })
    .eq("id", input.sourceId);
  if (updateError) return { error: "server" };

  if (delta !== 0) {
    await admin.from("referral_credit_ledger").insert({
      customer_id: source.referrer_customer_id,
      reward_source_id: source.id,
      entry_type: "adjustment",
      amount_cents: Math.abs(delta),
      balance_effect_cents: delta,
      status: "confirmed",
      confirmed_at: now,
      metadata: { reason, admin: true },
    });
  }

  await writeReferralAudit({
    adminUserId: session.user.id,
    action: "adjust_reward",
    reason,
    customerId: source.referrer_customer_id as string,
    rewardSourceId: source.id as string,
    previousValue: {
      remainingCents: previousRemaining,
      status: source.status,
    },
    newValue: { remainingCents: nextRemaining, status: nextStatus },
  });
  return { ok: true };
}

export async function adminCancelReferralReward(input: {
  sourceId: string;
  reason: string;
}): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "conflict" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  const reason = input.reason.trim();
  if (!reason) return { error: "conflict" };

  const admin = createAdminClient();
  const { data: source, error } = await admin
    .from("referral_reward_sources")
    .select("id, referrer_customer_id, remaining_credit_cents, status")
    .eq("id", input.sourceId)
    .maybeSingle();
  if (error) return { error: "server" };
  if (!source) return { error: "not_found" };
  if (source.status === "cancelled") return { ok: true };

  const remaining = Number(source.remaining_credit_cents);
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("referral_reward_sources")
    .update({
      remaining_credit_cents: 0,
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", input.sourceId);
  if (updateError) return { error: "server" };

  if (remaining > 0) {
    await admin.from("referral_credit_ledger").insert({
      customer_id: source.referrer_customer_id,
      reward_source_id: source.id,
      entry_type: "adjustment",
      amount_cents: remaining,
      balance_effect_cents: -remaining,
      status: "confirmed",
      confirmed_at: now,
      metadata: { reason, admin: true, kind: "cancel_reward" },
    });
  }

  await writeReferralAudit({
    adminUserId: session.user.id,
    action: "cancel_reward",
    reason,
    customerId: source.referrer_customer_id as string,
    rewardSourceId: source.id as string,
    previousValue: {
      remainingCents: remaining,
      status: source.status,
    },
    newValue: { remainingCents: 0, status: "cancelled" },
  });
  return { ok: true };
}

export async function adminResolveReferralRelationship(input: {
  relationshipId: string;
  action: "approve" | "cancel";
  reason: string;
}): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "conflict" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  const reason = input.reason.trim();
  if (!reason) return { error: "conflict" };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("referral_relationships")
    .select("id, status, referred_customer_id, review_required")
    .eq("id", input.relationshipId)
    .maybeSingle();
  if (error) return { error: "server" };
  if (!row) return { error: "not_found" };

  const nextStatus = input.action === "approve" ? "pending" : "cancelled";
  const { error: updateError } = await admin
    .from("referral_relationships")
    .update({
      status: nextStatus,
      review_required: false,
      review_notes: reason,
    })
    .eq("id", input.relationshipId);
  if (updateError) return { error: "server" };

  await writeReferralAudit({
    adminUserId: session.user.id,
    action:
      input.action === "approve"
        ? "approve_relationship"
        : "cancel_relationship",
    reason,
    customerId: row.referred_customer_id as string,
    relationshipId: row.id as string,
    previousValue: { status: row.status, reviewRequired: row.review_required },
    newValue: { status: nextStatus, reviewRequired: false },
  });
  return { ok: true };
}

export async function adminReviewReservation(input: {
  entryId: string;
  reason: string;
}): Promise<
  | { ok: true }
  | {
      error: "unauthenticated" | "forbidden" | "conflict" | "not_found" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!requireReleaseReason(input.reason)) {
    return { error: "conflict", message: "A reason is required." };
  }
  const result = await markReservationUnderReview({
    entryId: input.entryId,
    reason: input.reason,
    adminUserId: session.user.id,
  });
  if ("error" in result) return result;
  return { ok: true };
}

export async function adminReleaseReservation(input: {
  entryId: string;
  reason: string;
}): Promise<
  | { ok: true; message?: string }
  | {
      error: "unauthenticated" | "forbidden" | "conflict" | "not_found" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!requireReleaseReason(input.reason)) {
    return { error: "conflict", message: "A reason is required to release a reservation." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("referral_credit_ledger")
    .select(
      "id, status, customer_id, charge_id, stripe_payment_intent_id, reservation_expires_at",
    )
    .eq("id", input.entryId)
    .maybeSingle();
  if (!row) return { error: "not_found" };
  if (row.status !== "reserved" && row.status !== "under_review") {
    return { error: "conflict", message: "This reservation is no longer open." };
  }

  const paymentIntentId = row.stripe_payment_intent_id as string | null;
  let stripeStatus: string | null | "lookup_failed" = null;
  if (paymentIntentId) {
    const stripe = getStripe();
    if (!stripe) {
      stripeStatus = "lookup_failed";
    } else {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        stripeStatus = paymentIntent.status;
      } catch {
        stripeStatus = "lookup_failed";
      }
    }
  }

  const decision = evaluateStripeRelease(stripeStatus);
  if (decision.action === "complete_payment" && row.charge_id && paymentIntentId) {
    const paid = await confirmAppointmentCharge(row.charge_id, paymentIntentId);
    if ("error" in paid) {
      return { error: "conflict", message: decision.message };
    }
    return { error: "conflict", message: decision.message };
  }
  if (decision.action === "continue_payment") {
    return { error: "conflict", message: decision.message };
  }
  if (decision.action === "under_review" || decision.action === "lookup_failed") {
    await markReservationUnderReview({
      entryId: input.entryId,
      reason: input.reason,
      adminUserId: session.user.id,
    });
    return { error: "conflict", message: decision.message };
  }
  if (decision.action === "cancel_then_release" && paymentIntentId) {
    const stripe = getStripe();
    if (!stripe) {
      await markReservationUnderReview({
        entryId: input.entryId,
        reason: input.reason,
        adminUserId: session.user.id,
      });
      return { error: "conflict", message: "Stripe could not be queried." };
    }
    try {
      await stripe.paymentIntents.cancel(paymentIntentId);
    } catch {
      await markReservationUnderReview({
        entryId: input.entryId,
        reason: input.reason,
        adminUserId: session.user.id,
      });
      return { error: "conflict", message: "Stripe could not cancel this payment." };
    }
  }

  const released = await releaseLedgerReservation({
    entryId: input.entryId,
    reason: input.reason,
    adminUserId: session.user.id,
    stripeStatus,
  });
  if (!released.changed) {
    return { error: "conflict", message: "This reservation was already released." };
  }
  return { ok: true, message: decision.message };
}

