import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { dollarsToCents } from "@/lib/charges/money";
import type { ChargeLineItem } from "@/lib/charges/types";
import { householdVisitKey } from "@/lib/referrals/address";
import {
  reduceHouseholdEligibility,
  classifyHouseholdMatch,
  type HouseholdAddress,
  type HouseholdEligibility,
  type HouseholdIdentity,
} from "@/lib/referrals/household";
import {
  applyReservationRelease,
  requireReleaseReason,
} from "@/lib/referrals/reservation";
import {
  buildReferralCodeBase,
  nextReferralCodeCandidate,
  normalizeReferralCode,
} from "@/lib/referrals/codes";
import {
  NEW_CLIENT_DISCOUNT_BPS,
  centsToDollars,
  eligibleServiceCents,
  quoteReferralApplication,
  type ReferralApplyMode,
} from "@/lib/referrals/eligible";

export type ReferralCollectQuote = {
  availableCreditCents: number;
  eligibleCents: number;
  excludedCents: number;
  tipCents: number;
  discountCents: number;
  creditCents: number;
  dueCents: number;
  originalCents: number;
  applyNewClientDiscount: boolean;
  canUseCredit: boolean;
};

function visitKey(input: {
  customerId?: string;
  customer_id?: string;
  appointment_date: string;
  address_street: string;
  address_zip: string;
}) {
  return householdVisitKey({
    customerId: input.customerId ?? input.customer_id ?? "",
    appointmentDate: input.appointment_date,
    addressStreet: input.address_street,
    addressZip: input.address_zip,
  });
}

export async function ensurePetReferralCode(input: {
  petId: string;
  petName: string;
  ownerCustomerId: string;
}) {
  if (!hasSupabaseAdminConfig()) return null;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("pet_referral_codes")
    .select("id, referral_code")
    .eq("pet_id", input.petId)
    .maybeSingle();
  if (existing?.referral_code) return existing.referral_code as string;

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", input.ownerCustomerId)
    .maybeSingle();

  const base = buildReferralCodeBase({
    petName: input.petName,
    ownerFirstName: profile?.first_name ?? "",
    ownerLastName: profile?.last_name ?? "",
  });

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const code = nextReferralCodeCandidate(base, attempt);
    const { error } = await admin.from("pet_referral_codes").insert({
      pet_id: input.petId,
      owner_customer_id: input.ownerCustomerId,
      referral_code: code,
      referral_code_normalized: normalizeReferralCode(code),
      is_active: true,
    });
    if (!error) return code;
    if (error.code !== "23505") {
      console.error("ensurePetReferralCode failed:", error.message);
      return null;
    }
  }
  return null;
}

export async function ensureCustomerReferralCodes(customerId: string) {
  if (!hasSupabaseAdminConfig()) return;
  const admin = createAdminClient();
  const { data: pets } = await admin
    .from("pets")
    .select("id, name")
    .eq("customer_id", customerId)
    .is("archived_at", null);
  for (const pet of pets ?? []) {
    await ensurePetReferralCode({
      petId: pet.id as string,
      petName: String(pet.name ?? ""),
      ownerCustomerId: customerId,
    });
  }
}

export async function lookupReferralCode(code: string) {
  if (!hasSupabaseAdminConfig()) return null;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("pet_referral_codes")
    .select("id, pet_id, owner_customer_id, referral_code, is_active")
    .eq("referral_code_normalized", normalized)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

function profileIdentity(row: {
  id: string;
  email?: string | null;
  phone?: string | null;
  stripe_customer_id?: string | null;
}): HouseholdIdentity {
  return {
    customerId: row.id,
    email: row.email,
    phone: row.phone,
    stripeCustomerId: row.stripe_customer_id,
  };
}

function appointmentAddress(row: {
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
}): HouseholdAddress {
  return {
    street: row.address_street,
    city: row.address_city,
    state: row.address_state,
    zip: row.address_zip,
  };
}

export async function evaluateReferredHousehold(input: {
  referredCustomerId: string;
  referrerCustomerId?: string;
  extraAddresses?: HouseholdAddress[];
}): Promise<HouseholdEligibility> {
  if (
    input.referrerCustomerId &&
    input.referrerCustomerId === input.referredCustomerId
  ) {
    return {
      kind: "strong",
      reason: "same_account",
      eligibleForNewClientDiscount: false,
      reviewRequired: false,
    };
  }

  const admin = createAdminClient();
  const [{ data: referredProfile }, { data: referredAppointments }, { data: paidCharges }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, email, phone, stripe_customer_id")
        .eq("id", input.referredCustomerId)
        .maybeSingle(),
      admin
        .from("appointments")
        .select("address_street, address_city, address_state, address_zip")
        .eq("customer_id", input.referredCustomerId)
        .limit(20),
      admin
        .from("appointment_charges")
        .select("appointment_id")
        .eq("kind", "service")
        .eq("status", "paid"),
    ]);

  if (!referredProfile) {
    return {
      kind: "weak",
      reason: "profile_missing",
      eligibleForNewClientDiscount: false,
      reviewRequired: true,
    };
  }

  const paidAppointmentIds = [
    ...new Set((paidCharges ?? []).map((row) => row.appointment_id as string)),
  ];
  const { data: paidAppointments } = paidAppointmentIds.length
    ? await admin
        .from("appointments")
        .select(
          "customer_id, address_street, address_city, address_state, address_zip",
        )
        .in("id", paidAppointmentIds)
    : { data: [] };

  const otherIds = new Set<string>();
  if (input.referrerCustomerId) otherIds.add(input.referrerCustomerId);
  for (const row of paidAppointments ?? []) {
    if (row.customer_id !== input.referredCustomerId) {
      otherIds.add(row.customer_id as string);
    }
  }

  const { data: otherProfiles } = otherIds.size
    ? await admin
        .from("profiles")
        .select("id, email, phone, stripe_customer_id")
        .in("id", [...otherIds])
    : { data: [] };

  if (referredProfile.email) {
    const { data: emailMatches } = await admin
      .from("profiles")
      .select("id, email, phone, stripe_customer_id")
      .eq("email", referredProfile.email);
    for (const row of emailMatches ?? []) {
      if (row.id !== input.referredCustomerId) otherIds.add(row.id as string);
    }
  }
  if (referredProfile.stripe_customer_id) {
    const { data: stripeMatches } = await admin
      .from("profiles")
      .select("id, email, phone, stripe_customer_id")
      .eq("stripe_customer_id", referredProfile.stripe_customer_id);
    for (const row of stripeMatches ?? []) {
      if (row.id !== input.referredCustomerId) otherIds.add(row.id as string);
    }
  }

  const { data: extraProfiles } = otherIds.size
    ? await admin
        .from("profiles")
        .select("id, email, phone, stripe_customer_id")
        .in("id", [...otherIds])
    : { data: [] };

  const profiles = new Map(
    [...(otherProfiles ?? []), ...(extraProfiles ?? [])].map((row) => [
      row.id as string,
      row,
    ]),
  );
  const paidByCustomer = new Set(
    (paidAppointments ?? []).map((row) => row.customer_id as string),
  );
  const addressesByCustomer = new Map<string, HouseholdAddress[]>();
  for (const row of paidAppointments ?? []) {
    const list = addressesByCustomer.get(row.customer_id as string) ?? [];
    list.push(appointmentAddress(row));
    addressesByCustomer.set(row.customer_id as string, list);
  }
  if (input.referrerCustomerId) {
    const { data: referrerAppointments } = await admin
      .from("appointments")
      .select("address_street, address_city, address_state, address_zip")
      .eq("customer_id", input.referrerCustomerId)
      .limit(20);
    addressesByCustomer.set(
      input.referrerCustomerId,
      (referrerAppointments ?? []).map(appointmentAddress),
    );
  }

  const currentAddresses = [
    ...(referredAppointments ?? []).map(appointmentAddress),
    ...(input.extraAddresses ?? []),
  ];
  const current = profileIdentity(referredProfile);
  const results = [...profiles.values()].map((row) =>
    classifyHouseholdMatch({
      current,
      currentAddresses,
      other: profileIdentity(row),
      otherAddresses: addressesByCustomer.get(row.id as string) ?? [],
      otherHasPaidService: paidByCustomer.has(row.id as string),
    }),
  );
  return reduceHouseholdEligibility(results);
}

export async function householdHasPaidService(customerId: string) {
  const admin = createAdminClient();
  const { data: appointments } = await admin
    .from("appointments")
    .select("id")
    .eq("customer_id", customerId);
  const ids = (appointments ?? []).map((row) => row.id as string);
  if (ids.length === 0) return false;
  const { data: paid } = await admin
    .from("appointment_charges")
    .select("id")
    .in("appointment_id", ids)
    .eq("kind", "service")
    .eq("status", "paid")
    .limit(1);
  return (paid?.length ?? 0) > 0;
}

async function listVisitAppointments(input: {
  customerId: string;
  appointmentDate: string;
  addressStreet: string;
  addressZip: string;
}) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select(
      "id, customer_id, appointment_date, address_street, address_zip, service_ended_at, status",
    )
    .eq("customer_id", input.customerId)
    .eq("appointment_date", input.appointmentDate);
  const key = householdVisitKey({
    customerId: input.customerId,
    appointmentDate: input.appointmentDate,
    addressStreet: input.addressStreet,
    addressZip: input.addressZip,
  });
  return (data ?? []).filter(
    (row) =>
      visitKey({
        customerId: input.customerId,
        appointment_date: row.appointment_date as string,
        address_street: row.address_street as string,
        address_zip: row.address_zip as string,
      }) === key,
  ) as Array<{
    id: string;
    customer_id: string;
    appointment_date: string;
    address_street: string;
    address_zip: string;
    service_ended_at: string | null;
    status: string;
  }>;
}

export async function isFirstHouseholdVisit(input: {
  customerId: string;
  appointmentDate: string;
  addressStreet: string;
  addressZip: string;
}) {
  const admin = createAdminClient();
  const currentKey = visitKey({
    customerId: input.customerId,
    appointment_date: input.appointmentDate,
    address_street: input.addressStreet,
    address_zip: input.addressZip,
  });
  const { data: appointments } = await admin
    .from("appointments")
    .select("id, appointment_date, address_street, address_zip")
    .eq("customer_id", input.customerId);
  const rows = appointments ?? [];
  if (rows.length === 0) return true;
  const ids = rows.map((row) => row.id as string);
  const { data: paid } = await admin
    .from("appointment_charges")
    .select("appointment_id")
    .in("appointment_id", ids)
    .eq("kind", "service")
    .eq("status", "paid");
  const paidIds = new Set((paid ?? []).map((row) => row.appointment_id as string));
  if (paidIds.size === 0) return true;
  return rows
    .filter((row) => paidIds.has(row.id as string))
    .every((row) =>
      visitKey({
        customer_id: input.customerId,
        appointment_date: row.appointment_date as string,
        address_street: row.address_street as string,
        address_zip: row.address_zip as string,
      }) === currentKey,
    );
}

export async function attachReferralOnBooking(input: {
  referredCustomerId: string;
  appointmentId: string;
  code: string;
}): Promise<
  | { ok: true; applied: boolean; message?: string }
  | { ok: false; message: string }
> {
  const trimmed = input.code.trim();
  if (!trimmed) return { ok: true, applied: false };

  const found = await lookupReferralCode(trimmed);
  if (!found) {
    return {
      ok: false,
      message:
        "We couldn’t verify this referral code. Please check the code or contact K9 Atelier for assistance.",
    };
  }
  if (found.owner_customer_id === input.referredCustomerId) {
    return { ok: false, message: "You cannot use your own referral code." };
  }

  const household = await evaluateReferredHousehold({
    referredCustomerId: input.referredCustomerId,
    referrerCustomerId: found.owner_customer_id as string,
  });
  if (household.kind === "strong") {
    return {
      ok: false,
      message:
        household.reason === "same_account"
          ? "You cannot use your own referral code."
          : "Referral savings apply only to a household’s first paid appointment.",
    };
  }
  if (await householdHasPaidService(input.referredCustomerId)) {
    return {
      ok: false,
      message: "Referral savings apply only to a household’s first paid appointment.",
    };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("referral_relationships")
    .select("id, referral_code_id, status")
    .eq("referred_customer_id", input.referredCustomerId)
    .maybeSingle();

  if (existing) {
    if (existing.referral_code_id !== found.id) {
      return {
        ok: false,
        message: "A referral is already on file for this household.",
      };
    }
    await admin
      .from("appointments")
      .update({ referral_code: found.referral_code })
      .eq("id", input.appointmentId);
    return { ok: true, applied: true };
  }

  const { error } = await admin.from("referral_relationships").insert({
    referral_code_id: found.id,
    referrer_customer_id: found.owner_customer_id,
    referrer_pet_id: found.pet_id,
    referred_customer_id: input.referredCustomerId,
    first_appointment_id: input.appointmentId,
    status: household.reviewRequired ? "under_review" : "pending",
    review_required: household.reviewRequired,
    validated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, applied: true };
    }
    console.error("attachReferralOnBooking failed:", error.message);
    return { ok: false, message: "Could not save this referral code." };
  }

  await admin
    .from("appointments")
    .update({ referral_code: found.referral_code })
    .eq("id", input.appointmentId);

  return { ok: true, applied: true };
}

export async function validateReferralCodeForCustomer(
  customerId: string,
  code: string,
) {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false as const, message: "" };
  const found = await lookupReferralCode(trimmed);
  if (!found) {
    return {
      valid: false as const,
      message:
        "We couldn’t verify this referral code. Please check the code or contact K9 Atelier for assistance.",
    };
  }
  if (found.owner_customer_id === customerId) {
    return { valid: false as const, message: "You cannot use your own referral code." };
  }
  const household = await evaluateReferredHousehold({
    referredCustomerId: customerId,
    referrerCustomerId: found.owner_customer_id as string,
  });
  if (household.kind === "strong") {
    return {
      valid: false as const,
      message:
        household.reason === "same_account"
          ? "You cannot use your own referral code."
          : "Referral savings apply only to a household’s first paid appointment.",
    };
  }
  if (await householdHasPaidService(customerId)) {
    return {
      valid: false as const,
      message: "Referral savings apply only to a household’s first paid appointment.",
    };
  }
  return { valid: true as const, code: found.referral_code as string };
}

export async function releaseExpiredReferralReservations() {
  if (!hasSupabaseAdminConfig()) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("release_expired_referral_reservations");
  if (error) {
    console.error("releaseExpiredReferralReservations failed:", error.message);
    return 0;
  }
  return Number(data ?? 0);
}

export async function availableReferralCreditCents(customerId: string) {
  if (!hasSupabaseAdminConfig()) return 0;
  await releaseExpiredReferralReservations();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("referral_available_cents", {
    p_customer_id: customerId,
  });
  if (error) {
    console.error("availableReferralCreditCents failed:", error.message);
    return 0;
  }
  return Number(data ?? 0);
}

export async function getCollectReferralState(input: {
  customerId: string;
  appointmentId: string;
  appointmentDate: string;
  addressStreet: string;
  addressZip: string;
  kind: "service" | "no_show" | "cancellation";
}) {
  const availableCreditCents = await availableReferralCreditCents(input.customerId);
  if (input.kind !== "service") {
    return {
      availableCreditCents,
      applyNewClientDiscount: false,
      canUseCredit: availableCreditCents > 0,
    };
  }

  const admin = createAdminClient();
  const { data: relationship } = await admin
    .from("referral_relationships")
    .select("id, status, referrer_customer_id")
    .eq("referred_customer_id", input.customerId)
    .in("status", ["pending", "completed"])
    .maybeSingle();

  const household = await evaluateReferredHousehold({
    referredCustomerId: input.customerId,
    referrerCustomerId: relationship?.referrer_customer_id as string | undefined,
    extraAddresses: [
      {
        street: input.addressStreet,
        zip: input.addressZip,
      },
    ],
  });

  const firstVisit = await isFirstHouseholdVisit({
    customerId: input.customerId,
    appointmentDate: input.appointmentDate,
    addressStreet: input.addressStreet,
    addressZip: input.addressZip,
  });

  const applyNewClientDiscount = Boolean(
    relationship &&
      relationship.status === "pending" &&
      household.eligibleForNewClientDiscount &&
      !household.reviewRequired &&
      firstVisit &&
      (await householdCompletedService(input.appointmentId)),
  );

  return {
    availableCreditCents,
    applyNewClientDiscount,
    canUseCredit: availableCreditCents > 0 && !applyNewClientDiscount,
  };
}

async function householdCompletedService(appointmentId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("service_ended_at")
    .eq("id", appointmentId)
    .maybeSingle();
  return Boolean(data?.service_ended_at);
}

export function buildCollectQuote(input: {
  lineItems: ChargeLineItem[];
  tipAmount: number;
  availableCreditCents: number;
  mode: ReferralApplyMode;
  customDollars?: number;
  applyNewClientDiscount: boolean;
}): ReferralCollectQuote {
  const quote = quoteReferralApplication(input);
  return {
    ...quote,
    availableCreditCents: input.availableCreditCents,
    applyNewClientDiscount: input.applyNewClientDiscount,
    canUseCredit:
      input.availableCreditCents > 0 && !input.applyNewClientDiscount,
  };
}

export async function reserveReferralCredit(input: {
  customerId: string;
  chargeId: string;
  appointmentId: string;
  amountCents: number;
  adminUserId?: string;
}) {
  if (input.amountCents <= 0) return { ok: true as const, entryId: null };
  await releaseExpiredReferralReservations();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_referral_credit", {
    p_customer_id: input.customerId,
    p_charge_id: input.chargeId,
    p_appointment_id: input.appointmentId,
    p_amount_cents: input.amountCents,
    p_admin_id: input.adminUserId ?? null,
  });
  if (error) {
    console.error("reserveReferralCredit failed:", error.message);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, entryId: data as string };
}

export async function confirmReferralDebit(chargeId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("referral_credit_ledger")
    .update({
      status: "confirmed",
      confirmed_at: now,
    })
    .eq("charge_id", chargeId)
    .eq("entry_type", "debit")
    .in("status", ["reserved", "under_review"]);
  if (error) console.error("confirmReferralDebit failed:", error.message);
}

export async function attachReservationPaymentIntent(
  chargeId: string,
  paymentIntentId: string,
) {
  const admin = createAdminClient();
  await admin
    .from("referral_credit_ledger")
    .update({
      stripe_payment_intent_id: paymentIntentId,
      payment_id: paymentIntentId,
    })
    .eq("charge_id", chargeId)
    .eq("entry_type", "debit")
    .in("status", ["reserved", "under_review"]);
}

export async function reverseReferralDebit(chargeId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("referral_credit_ledger")
    .select(
      "id, status, amount_cents, balance_effect_cents, customer_id, appointment_id, charge_id",
    )
    .eq("charge_id", chargeId)
    .eq("entry_type", "debit")
    .in("status", ["reserved", "under_review"])
    .maybeSingle();
  if (!row) return;

  await appendLedgerReversal({
    debit: {
      id: row.id as string,
      status: row.status as string,
      customer_id: row.customer_id as string,
      appointment_id: (row.appointment_id as string | null) ?? null,
      charge_id: (row.charge_id as string | null) ?? chargeId,
      amount_cents: Number(row.amount_cents),
      balance_effect_cents: Number(row.balance_effect_cents),
    },
    nextStatus: "reversed",
    reason: "payment_failed",
  });
}

export type IssueReferralResult =
  | { status: "issued"; rewardCents: number }
  | { status: "already_issued" }
  | { status: "skipped"; reason: string }
  | { status: "needs_recovery"; reason: string };

/**
 * Issue referrer credit after a Collect charge is paid.
 * Safe to call from Collect or a future Stripe webhook.
 */
export async function issueReferralRewardForPaidCharge(
  chargeId: string,
): Promise<IssueReferralResult> {
  const admin = createAdminClient();
  const { data: charge, error: chargeError } = await admin
    .from("appointment_charges")
    .select(
      "id, appointment_id, kind, status, new_client_discount, stripe_payment_intent_id",
    )
    .eq("id", chargeId)
    .maybeSingle();

  if (chargeError) {
    console.error("issueReferralRewardForPaidCharge load failed:", chargeError.message);
    return { status: "needs_recovery", reason: chargeError.message };
  }
  if (!charge) return { status: "skipped", reason: "charge_missing" };
  if (charge.kind !== "service") return { status: "skipped", reason: "not_service" };
  if (charge.status !== "paid") return { status: "skipped", reason: "not_paid" };

  const { data: appointment } = await admin
    .from("appointments")
    .select(
      "id, customer_id, appointment_date, address_street, address_zip, service_ended_at, status",
    )
    .eq("id", charge.appointment_id)
    .maybeSingle();
  if (!appointment) return { status: "skipped", reason: "appointment_missing" };
  if (!appointment.service_ended_at) {
    return { status: "skipped", reason: "service_not_completed" };
  }

  const { data: relationship } = await admin
    .from("referral_relationships")
    .select("id, referrer_customer_id, referred_customer_id, status")
    .eq("referred_customer_id", appointment.customer_id)
    .maybeSingle();
  if (!relationship || relationship.status === "cancelled") {
    return { status: "skipped", reason: "no_relationship" };
  }
  if (relationship.status === "under_review") {
    return { status: "skipped", reason: "under_review" };
  }

  const key = visitKey({
    customerId: appointment.customer_id as string,
    appointment_date: appointment.appointment_date as string,
    address_street: appointment.address_street as string,
    address_zip: appointment.address_zip as string,
  });

  const { data: existingVisit } = await admin
    .from("referral_reward_sources")
    .select("id")
    .eq("referral_relationship_id", relationship.id)
    .eq("visit_key", key)
    .maybeSingle();
  if (existingVisit) return { status: "already_issued" };

  const firstVisit = await isFirstHouseholdVisit({
    customerId: appointment.customer_id as string,
    appointmentDate: appointment.appointment_date as string,
    addressStreet: appointment.address_street as string,
    addressZip: appointment.address_zip as string,
  });
  if (!firstVisit) return { status: "skipped", reason: "not_first_visit" };

  const group = await listVisitAppointments({
    customerId: appointment.customer_id as string,
    appointmentDate: appointment.appointment_date as string,
    addressStreet: appointment.address_street as string,
    addressZip: appointment.address_zip as string,
  });
  const active = group.filter((row) => row.status !== "cancelled");
  if (active.length === 0) return { status: "skipped", reason: "no_active_visit" };
  if (active.some((row) => !row.service_ended_at)) {
    return { status: "skipped", reason: "visit_not_finished" };
  }

  const activeIds = active.map((row) => row.id);
  const { data: paidCharges } = await admin
    .from("appointment_charges")
    .select("id, appointment_id, kind, status, new_client_discount, line_items")
    .in("appointment_id", activeIds)
    .eq("kind", "service")
    .eq("status", "paid");

  const paidByAppointment = new Set(
    (paidCharges ?? []).map((row) => row.appointment_id as string),
  );
  if (active.some((row) => !paidByAppointment.has(row.id))) {
    return { status: "skipped", reason: "visit_not_paid" };
  }

  let eligibleCents = 0;
  let discountCents = 0;
  for (const paid of paidCharges ?? []) {
    discountCents += dollarsToCents(Number(paid.new_client_discount ?? 0));
    const items = Array.isArray(paid.line_items)
      ? (paid.line_items as ChargeLineItem[])
      : [];
    eligibleCents += eligibleServiceCents(items);
  }
  if (discountCents <= 0) {
    discountCents = Math.floor((eligibleCents * NEW_CLIENT_DISCOUNT_BPS) / 10_000);
  }
  if (discountCents <= 0) return { status: "skipped", reason: "no_discount" };

  const now = new Date().toISOString();
  const { data: source, error: sourceError } = await admin
    .from("referral_reward_sources")
    .insert({
      referral_relationship_id: relationship.id,
      referrer_customer_id: relationship.referrer_customer_id,
      referred_customer_id: relationship.referred_customer_id,
      source_appointment_id: appointment.id,
      source_charge_id: chargeId,
      visit_key: key,
      source_payment_id: charge.stripe_payment_intent_id,
      eligible_subtotal_cents: eligibleCents,
      new_client_discount_cents: discountCents,
      reward_credit_cents: discountCents,
      remaining_credit_cents: discountCents,
      status: "available",
      issued_at: now,
    })
    .select("id")
    .single();

  if (sourceError) {
    if (sourceError.code === "23505") return { status: "already_issued" };
    console.error("issueReferralReward insert source failed:", sourceError.message);
    return { status: "needs_recovery", reason: sourceError.message };
  }

  const { error: ledgerError } = await admin.from("referral_credit_ledger").insert({
    customer_id: relationship.referrer_customer_id,
    reward_source_id: source.id,
    entry_type: "credit",
    amount_cents: discountCents,
    balance_effect_cents: discountCents,
    appointment_id: appointment.id,
    charge_id: chargeId,
    payment_id: charge.stripe_payment_intent_id,
    status: "confirmed",
    confirmed_at: now,
    metadata: { kind: "referral_reward" },
  });

  if (ledgerError) {
    console.error("issueReferralReward ledger failed:", ledgerError.message);
    return { status: "needs_recovery", reason: ledgerError.message };
  }

  await admin
    .from("referral_relationships")
    .update({ status: "completed", completed_at: now })
    .eq("id", relationship.id)
    .eq("status", "pending");

  return { status: "issued", rewardCents: discountCents };
}

export async function getAccountReferralView(customerId: string) {
  await ensureCustomerReferralCodes(customerId);
  const admin = createAdminClient();
  const availableCreditCents = await availableReferralCreditCents(customerId);

  const { data: codes } = await admin
    .from("pet_referral_codes")
    .select("referral_code, pet_id")
    .eq("owner_customer_id", customerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const petIds = [...new Set((codes ?? []).map((row) => row.pet_id as string))];
  const { data: ownedPets } = petIds.length
    ? await admin.from("pets").select("id, name").in("id", petIds)
    : { data: [] };
  const ownedPetNames = new Map(
    (ownedPets ?? []).map((row) => [row.id as string, String(row.name ?? "Dog")]),
  );

  const { data: sources } = await admin
    .from("referral_reward_sources")
    .select(
      "id, status, reward_credit_cents, remaining_credit_cents, issued_at, created_at, referral_relationship_id",
    )
    .eq("referrer_customer_id", customerId)
    .order("created_at", { ascending: false });

  const relationshipIds = [
    ...new Set((sources ?? []).map((row) => row.referral_relationship_id as string)),
  ];
  const labels = new Map<string, { pet: string; code: string }>();
  if (relationshipIds.length > 0) {
    const { data: rels } = await admin
      .from("referral_relationships")
      .select("id, referral_code_id, referred_customer_id")
      .in("id", relationshipIds);
    const codeIds = [
      ...new Set((rels ?? []).map((row) => row.referral_code_id as string)),
    ];
    const { data: relCodes } = codeIds.length
      ? await admin
          .from("pet_referral_codes")
          .select("id, referral_code")
          .in("id", codeIds)
      : { data: [] };
    const codeById = new Map(
      (relCodes ?? []).map((row) => [row.id as string, row.referral_code as string]),
    );
    const referredIds = [
      ...new Set((rels ?? []).map((row) => row.referred_customer_id as string)),
    ];
    const [{ data: referredProfiles }, { data: referredPets }] = await Promise.all([
      referredIds.length
        ? admin.from("profiles").select("id, last_name").in("id", referredIds)
        : Promise.resolve({ data: [] }),
      referredIds.length
        ? admin
            .from("pets")
            .select("customer_id, name")
            .in("customer_id", referredIds)
            .is("archived_at", null)
        : Promise.resolve({ data: [] }),
    ]);
    const lastByCustomer = new Map(
      (referredProfiles ?? []).map((row) => [
        row.id as string,
        String(row.last_name ?? "").trim().slice(0, 1).toUpperCase() || "G",
      ]),
    );
    const petByCustomer = new Map<string, string>();
    for (const pet of referredPets ?? []) {
      if (!petByCustomer.has(pet.customer_id as string)) {
        petByCustomer.set(pet.customer_id as string, String(pet.name ?? "Friend"));
      }
    }
    for (const rel of rels ?? []) {
      const initial = lastByCustomer.get(rel.referred_customer_id as string) ?? "G";
      const petName =
        petByCustomer.get(rel.referred_customer_id as string) ?? "Friend";
      labels.set(rel.id as string, {
        pet: `${petName} ${initial}.`,
        code: codeById.get(rel.referral_code_id as string) ?? "",
      });
    }
  }

  return {
    availableCreditCents,
    availableLabel: centsToDollars(availableCreditCents).toFixed(2),
    codes: (codes ?? []).map((row) => ({
      petName: ownedPetNames.get(row.pet_id as string) ?? "Dog",
      code: row.referral_code as string,
    })),
    rewards: (sources ?? []).map((row) => {
      const label = labels.get(row.referral_relationship_id as string);
      return {
        id: row.id as string,
        date: (row.issued_at as string | null) ?? (row.created_at as string),
        referral: label?.pet ?? "Friend",
        code: label?.code ?? "",
        status: row.status as string,
        amountCents: Number(row.reward_credit_cents),
        remainingCents: Number(row.remaining_credit_cents),
      };
    }),
  };
}

async function appendLedgerReversal(input: {
  debit: {
    id: string;
    status: string;
    customer_id: string;
    appointment_id: string | null;
    charge_id: string | null;
    amount_cents: number;
    balance_effect_cents: number;
  };
  nextStatus: "released" | "reversed";
  reason: string;
  adminUserId?: string;
  stripeStatus?: string | null;
}) {
  if (input.debit.status === "confirmed") {
    return { changed: false as const, status: "confirmed" };
  }
  const next = applyReservationRelease({
    status: input.debit.status,
    amountCents: input.debit.amount_cents,
    balanceEffectCents: input.debit.balance_effect_cents,
  });
  if (input.nextStatus === "released" && !next.changed) {
    return { changed: false as const, status: input.debit.status };
  }
  if (input.debit.status !== "reserved" && input.debit.status !== "under_review") {
    return { changed: false as const, status: input.debit.status };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: input.nextStatus,
    released_at: now,
    release_reason: input.reason,
  };
  if (input.nextStatus === "reversed") update.reversed_at = now;

  const { data: updated } = await admin
    .from("referral_credit_ledger")
    .update(update)
    .eq("id", input.debit.id)
    .in("status", ["reserved", "under_review"])
    .select("id, amount_cents, balance_effect_cents")
    .maybeSingle();
  if (!updated) return { changed: false as const, status: input.debit.status };

  const { data: reversal, error } = await admin
    .from("referral_credit_ledger")
    .insert({
      customer_id: input.debit.customer_id,
      entry_type: "reversal",
      amount_cents: Number(updated.amount_cents),
      balance_effect_cents: -Number(updated.balance_effect_cents),
      appointment_id: input.debit.appointment_id,
      charge_id: input.debit.charge_id,
      related_ledger_entry_id: input.debit.id,
      status: "confirmed",
      confirmed_at: now,
      metadata: {
        related_ledger_entry_id: input.debit.id,
        reason: input.reason,
        stripeStatus: input.stripeStatus ?? null,
      },
    })
    .select("id")
    .maybeSingle();

  if (error && error.code !== "23505") {
    console.error("appendLedgerReversal insert failed:", error.message);
  }

  await writeReferralAudit({
    adminUserId: input.adminUserId,
    action:
      input.nextStatus === "reversed" ? "reverse_reservation" : "release_reservation",
    reason: input.reason,
    customerId: input.debit.customer_id,
    ledgerEntryId: input.debit.id,
    previousValue: { status: input.debit.status, debitId: input.debit.id },
    newValue: {
      status: input.nextStatus,
      debitId: input.debit.id,
      reversalId: reversal?.id ?? null,
      stripeStatus: input.stripeStatus ?? null,
    },
    metadata: {
      debitId: input.debit.id,
      reversalId: reversal?.id ?? null,
      stripeStatus: input.stripeStatus ?? null,
    },
  });
  return {
    changed: true as const,
    status: input.nextStatus,
    reversalId: (reversal?.id as string | undefined) ?? null,
  };
}

export async function writeReferralAudit(input: {
  adminUserId?: string;
  action: string;
  reason?: string;
  customerId?: string;
  relationshipId?: string;
  rewardSourceId?: string;
  ledgerEntryId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}) {
  if (!hasSupabaseAdminConfig()) return;
  const admin = createAdminClient();
  await admin.from("referral_audit_log").insert({
    admin_user_id: input.adminUserId ?? null,
    action: input.action,
    reason: input.reason ?? null,
    customer_id: input.customerId ?? null,
    referral_relationship_id: input.relationshipId ?? null,
    reward_source_id: input.rewardSourceId ?? null,
    ledger_entry_id: input.ledgerEntryId ?? null,
    previous_value: input.previousValue ?? null,
    new_value: input.newValue ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function markReservationUnderReview(input: {
  entryId: string;
  reason: string;
  adminUserId: string;
}) {
  if (!requireReleaseReason(input.reason)) {
    return { error: "conflict" as const, message: "A reason is required." };
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("referral_credit_ledger")
    .select("id, status, customer_id, balance_effect_cents")
    .eq("id", input.entryId)
    .maybeSingle();
  if (!row) return { error: "not_found" as const };
  if (row.status !== "reserved" && row.status !== "under_review") {
    return { error: "conflict" as const, message: "This reservation cannot be reviewed." };
  }
  await admin
    .from("referral_credit_ledger")
    .update({
      status: "under_review",
      release_reason: input.reason.trim(),
    })
    .eq("id", input.entryId)
    .in("status", ["reserved", "under_review"]);
  await writeReferralAudit({
    adminUserId: input.adminUserId,
    action: "reservation_under_review",
    reason: input.reason.trim(),
    customerId: row.customer_id as string,
    ledgerEntryId: row.id as string,
    previousValue: { status: row.status },
    newValue: { status: "under_review" },
  });
  return { ok: true as const };
}

export async function releaseLedgerReservation(input: {
  entryId: string;
  reason: string;
  adminUserId?: string;
  stripeStatus?: string | null;
}) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("referral_credit_ledger")
    .select(
      "id, status, customer_id, appointment_id, charge_id, amount_cents, balance_effect_cents",
    )
    .eq("id", input.entryId)
    .maybeSingle();
  if (!row) return { changed: false as const, status: "missing" };

  return appendLedgerReversal({
    debit: {
      id: row.id as string,
      status: row.status as string,
      customer_id: row.customer_id as string,
      appointment_id: (row.appointment_id as string | null) ?? null,
      charge_id: (row.charge_id as string | null) ?? null,
      amount_cents: Number(row.amount_cents),
      balance_effect_cents: Number(row.balance_effect_cents),
    },
    nextStatus: "released",
    reason: input.reason.trim(),
    adminUserId: input.adminUserId,
    stripeStatus: input.stripeStatus,
  });
}
