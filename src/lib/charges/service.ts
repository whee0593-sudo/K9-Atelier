import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { fetchAppointmentAdminRecord } from "@/lib/email/appointment-context";
import {
  getOrCreateStripeCustomerId,
  listStaffCustomerPaymentMethods,
} from "@/lib/payments/service";
import { getStripe } from "@/lib/stripe/server";
import {
  getStripePublishableKey,
  isStripeConfigured,
} from "@/lib/stripe/config";
import {
  buildDefaultLineItems,
  buildNoShowLineItems,
  catalogChargeGroups,
  catalogChargeItems,
  sanitizeLineItems,
} from "@/lib/charges/line-items";
import { readStoredVisitLineItems } from "@/lib/charges/visit-line-items";
import { withCatalogListAmount } from "@/lib/charges/list-amount";
import { dollarsToCents, sumLineItems } from "@/lib/charges/money";
import type {
  AppointmentChargeRecord,
  ChargeKind,
  ChargeLineItem,
  ChargeTender,
  CollectContext,
  CreateChargeInput,
  ReceiptChannel,
} from "@/lib/charges/types";
import { isManualTender, readChargeTender } from "@/lib/charges/tender";
import { formatReceiptPaymentMethod } from "@/lib/charges/receipt-view";
import {
  buildVisitBill,
  chargedVisitSnapshot,
  decideVisitServiceCharge,
  isFullyRefundedPayment,
  serviceChargeHasVisitBill,
  visitPaymentStatus,
  type VisitBillSnapshot,
  type VisitCheckoutPet,
} from "@/lib/charges/visit-bill";
import { getAddOnService, getServicePriceEstimate } from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import {
  attemptSavedCardCharge,
  customerFacingStripeMessage,
  savedCardIdempotencyKey,
  type AttemptCharge,
} from "@/lib/charges/saved-card-payment";
import {
  sendAfterVisitThankYouSms,
  sendChargeReceiptEmail,
} from "@/lib/charges/receipts";
import { householdVisitKey } from "@/lib/referrals/address";
import { centsToDollars } from "@/lib/referrals/eligible";
import {
  buildCollectQuote,
  attachReferralOnBooking,
  attachReservationPaymentIntent,
  confirmReferralDebit,
  getCollectReferralState,
  issueReferralRewardForPaidCharge,
  reserveReferralCredit,
  reverseReferralDebit,
  writeReferralAudit,
} from "@/lib/referrals/service";

const CHARGE_SELECT =
  "id, appointment_id, visit_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id, refunded_amount, payment_method_id, tender, bill_snapshot";

type ChargeRow = {
  id: string;
  appointment_id: string;
  visit_id?: string | null;
  kind: ChargeKind;
  status: "pending" | "paid" | "failed";
  line_items: ChargeLineItem[];
  subtotal: number;
  tip_amount: number;
  total: number;
  receipt_channel: ReceiptChannel | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  refunded_amount?: number | null;
  payment_method_id?: string | null;
  tender?: ChargeTender | null;
  bill_snapshot?: VisitBillSnapshot | null;
};

function mapCharge(row: ChargeRow & { refunded_amount?: number | null }): AppointmentChargeRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    visitId: row.visit_id ?? null,
    kind: row.kind,
    status: row.status,
    lineItems: row.line_items,
    subtotal: Number(row.subtotal),
    tipAmount: Number(row.tip_amount),
    total: Number(row.total),
    receiptChannel: row.receipt_channel,
    paidAt: row.paid_at,
    refundedAmount: Number(row.refunded_amount ?? 0),
    paymentMethodId: (row.payment_method_id as string | null | undefined) ?? null,
    tender: readChargeTender(row.tender),
    billSnapshot: row.bill_snapshot ?? null,
  };
}

export async function getCollectContext(
  appointmentId: string,
): Promise<
  | { context: CollectContext }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const appointment = await fetchAppointmentAdminRecord(appointmentId);
  if (!appointment) return { error: "not_found" };

  const admin = createAdminClient();
  const { data: pet, error: petError } = await admin
    .from("pets")
    .select("weight_lbs")
    .eq("id", appointment.petId)
    .maybeSingle();

  if (petError) {
    console.error("getCollectContext pet failed:", petError.message);
    return { error: "server" };
  }

  const weightLbs = Number(pet?.weight_lbs ?? 0);
  const methods = await listStaffCustomerPaymentMethods(appointment.customerId);
  if ("error" in methods) return { error: methods.error };

  const visitCollect = appointment.visitId
    ? await loadVisitCollect(admin, appointment.visitId)
    : null;
  if (visitCollect && "error" in visitCollect) return { error: visitCollect.error };

  const chargeQuery = admin.from("appointment_charges").select(CHARGE_SELECT);
  const visitChargeFilter = visitCollect
    ? visitCollect.appointmentIds.length > 0
      ? `visit_id.eq.${visitCollect.bill.visitId},appointment_id.in.(${visitCollect.appointmentIds.join(",")})`
      : `visit_id.eq.${visitCollect.bill.visitId}`
    : null;
  const { data: charges, error: chargeError } = visitChargeFilter
    ? await chargeQuery.or(visitChargeFilter)
    : await chargeQuery.eq("appointment_id", appointmentId).eq("status", "paid");

  if (chargeError) {
    console.error("getCollectContext charges failed:", chargeError.message);
    return { error: "server" };
  }

  const { data: appointmentRow } = await admin
    .from("appointments")
    .select("payment_method_id")
    .eq("id", appointmentId)
    .maybeSingle();

  const { data: timing } = await admin
    .from("appointments")
    .select("service_started_at, service_ended_at, add_on_options")
    .eq("id", appointmentId)
    .maybeSingle();

  const selectedPaymentMethodId =
    (appointmentRow?.payment_method_id as string | null) ??
    methods.methods.find((method) => method.isDefault)?.id ??
    methods.methods[0]?.id ??
    null;

  const appointmentWithTiming = {
    ...appointment,
    serviceStartedAt:
      (timing?.service_started_at as string | null | undefined) ?? null,
    serviceEndedAt:
      (timing?.service_ended_at as string | null | undefined) ?? null,
  };
  const catalog = catalogChargeItems(weightLbs);
  const chargeRows = (charges ?? []) as ChargeRow[];
  const paidRows = chargeRows.filter(
    (row) =>
      row.status === "paid" &&
      !isFullyRefundedPayment(Number(row.total), Number(row.refunded_amount ?? 0)),
  );
  const visitCharges = chargeRows
    .filter((row) => row.kind === "service")
    .map((row) => ({
      status: row.status,
      hasSnapshot: row.bill_snapshot != null,
      appointmentId: row.appointment_id,
      fullyRefunded: isFullyRefundedPayment(
        Number(row.total),
        Number(row.refunded_amount ?? 0),
      ),
    }));
  const visitDecision = decideVisitServiceCharge(visitCharges);
  const defaultItems = visitCollect
    ? visitCollect.bill.lineItems
    : withCatalogListAmount(
        readStoredVisitLineItems(
          (timing?.add_on_options as Record<string, unknown> | null) ?? null,
        ) ?? buildDefaultLineItems(appointment, weightLbs),
        catalog,
      );

  return {
    context: {
      appointment: appointmentWithTiming,
      petWeightLbs: weightLbs,
      lineItems: defaultItems,
      catalog,
      catalogGroups: catalogChargeGroups(weightLbs),
      methods: methods.methods,
      selectedPaymentMethodId,
      paidKinds: paidRows.map((row) => row.kind),
      paidCharges: paidRows.map((row) => mapCharge(row)),
      stripeConfigured: isStripeConfigured(),
      stripePublishableKey: getStripePublishableKey(),
      ...(visitCollect
        ? {
            visit: {
              id: visitCollect.bill.visitId,
              customerName: visitCollect.bill.customerName,
              serviceDate: visitCollect.bill.serviceDate,
              arrivalLabel: visitCollect.bill.arrivalLabel,
              servicedDogCount: visitCollect.bill.servicedDogCount,
              blockedMessage:
                visitDecision === "legacy_paid"
                  ? "This visit already has a payment recorded on one dog. That receipt stays as it is."
                  : visitDecision === "in_progress"
                    ? "A payment is already in progress. Please wait a moment and try again."
                    : visitCollect.bill.blockedMessage,
              paymentStatus: visitPaymentStatus(visitCharges),
            },
          }
        : {}),
      referral: await getCollectReferralState({
        customerId: appointment.customerId,
        appointmentId,
        appointmentDate: appointment.appointmentDate,
        addressStreet: appointment.addressStreet,
        addressZip: appointment.addressZip,
        kind: "service",
      }),
    },
  };
}

async function loadVisitCollect(
  admin: ReturnType<typeof createAdminClient>,
  visitId: string,
): Promise<
  | {
      bill: ReturnType<typeof buildVisitBill>;
      appointmentIds: string[];
    }
  | { error: "not_found" | "server" }
> {
  const { data: visit, error: visitError } = await admin
    .from("visits")
    .select(
      "id, travel_fee, appointment_time, service_date, profiles ( first_name, last_name )",
    )
    .eq("id", visitId)
    .maybeSingle();
  if (visitError) {
    console.error("loadVisitCollect visit failed:", visitError.message);
    return { error: "server" };
  }
  if (!visit) return { error: "not_found" };

  const { data: rows, error: rowError } = await admin
    .from("appointments")
    .select(
      "id, status, service_name, service_id, service_price, service_ended_at, visit_sequence, add_on_ids, add_on_options, pets ( name, weight_lbs )",
    )
    .eq("visit_id", visitId)
    .order("visit_sequence", { ascending: true });
  if (rowError) {
    console.error("loadVisitCollect appointments failed:", rowError.message);
    return { error: "server" };
  }

  const profile = visit.profiles as
    | { first_name?: string | null; last_name?: string | null }
    | { first_name?: string | null; last_name?: string | null }[]
    | null;
  const profileRow = Array.isArray(profile) ? profile[0] : profile;
  const customerName = [profileRow?.first_name, profileRow?.last_name]
    .filter(Boolean)
    .join(" ");

  const pets: VisitCheckoutPet[] = (rows ?? []).map((row) => {
    const pet = row.pets as
      | { name?: string | null; weight_lbs?: number | null }
      | { name?: string | null; weight_lbs?: number | null }[]
      | null;
    const petRow = Array.isArray(pet) ? pet[0] : pet;
    const weight = Number(petRow?.weight_lbs ?? 0);
    const addOnIds = (row.add_on_ids as string[] | null) ?? [];
    const addOnOptions =
      (row.add_on_options as Record<string, string> | null) ?? {};
    return {
      appointmentId: row.id as string,
      petName: petRow?.name?.trim() || "Dog",
      serviceName: String(row.service_name ?? "Service"),
      servicePrice:
        row.service_price == null ? null : Number(row.service_price),
      status: String(row.status ?? ""),
      serviceEndedAt: (row.service_ended_at as string | null) ?? null,
      addOns: addOnIds.map((addOnId) => {
        const addOn = getAddOnService(addOnId);
        const optionName = addOnOptions[addOnId];
        const estimate = addOn
          ? getServicePriceEstimate(addOn, weight, optionName)
          : null;
        return {
          label: addOn
            ? getServiceDisplayName(addOn.id, addOn.name)
            : addOnId,
          amount: Number(estimate?.from ?? 0),
          catalogId: addOnId,
        };
      }),
    };
  });

  const bill = buildVisitBill({
    visitId,
    customerName: customerName || "Guest",
    serviceDate: String(visit.service_date ?? ""),
    arrivalLabel: String(visit.appointment_time ?? ""),
    travelFee: Number(visit.travel_fee ?? 0),
    pets,
  });
  return {
    bill,
    appointmentIds: pets.map((pet) => pet.appointmentId),
  };
}

export async function listPaidKindsByAppointment(
  appointmentIds: string[],
): Promise<Record<string, ChargeKind[]>> {
  if (appointmentIds.length === 0) return {};
  const admin = createAdminClient();
  const [{ data, error }, { data: appointments, error: appointmentError }] =
    await Promise.all([
      admin
        .from("appointment_charges")
        .select("appointment_id, kind, total, refunded_amount")
        .in("appointment_id", appointmentIds)
        .eq("status", "paid"),
      admin.from("appointments").select("id, visit_id").in("id", appointmentIds),
    ]);

  if (error) {
    console.error("listPaidKindsByAppointment failed:", error.message);
    return {};
  }
  if (appointmentError) {
    console.error(
      "listPaidKindsByAppointment visits failed:",
      appointmentError.message,
    );
  }

  const map: Record<string, ChargeKind[]> = {};
  for (const row of data ?? []) {
    if (
      isFullyRefundedPayment(Number(row.total), Number(row.refunded_amount ?? 0))
    ) {
      continue;
    }
    const id = row.appointment_id as string;
    const kind = row.kind as ChargeKind;
    if (!map[id]?.includes(kind)) map[id] = [...(map[id] ?? []), kind];
  }

  const visitByAppointment = new Map<string, string>();
  for (const row of appointments ?? []) {
    if (row.visit_id) visitByAppointment.set(row.id as string, row.visit_id as string);
  }
  const visitIds = [...new Set(visitByAppointment.values())];
  if (visitIds.length === 0) return map;

  const { data: visitCharges, error: visitError } = await admin
    .from("appointment_charges")
    .select("visit_id, kind, total, refunded_amount")
    .in("visit_id", visitIds)
    .eq("kind", "service")
    .eq("status", "paid")
    .not("bill_snapshot", "is", null);
  if (visitError) {
    console.error("listPaidKindsByAppointment visit charges failed:", visitError.message);
    return map;
  }

  const kindsByVisit = new Map<string, ChargeKind[]>();
  for (const row of visitCharges ?? []) {
    if (
      isFullyRefundedPayment(Number(row.total), Number(row.refunded_amount ?? 0))
    ) {
      continue;
    }
    const visitId = row.visit_id as string;
    const kind = row.kind as ChargeKind;
    const current = kindsByVisit.get(visitId) ?? [];
    if (!current.includes(kind)) kindsByVisit.set(visitId, [...current, kind]);
  }
  for (const [appointmentId, visitId] of visitByAppointment) {
    for (const kind of kindsByVisit.get(visitId) ?? []) {
      if (!map[appointmentId]?.includes(kind)) {
        map[appointmentId] = [...(map[appointmentId] ?? []), kind];
      }
    }
  }
  return map;
}

export async function createAppointmentCharge(
  input: CreateChargeInput,
): Promise<
  | {
      charge: AppointmentChargeRecord;
      clientSecret?: string;
      requiresAction?: boolean;
    }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "misconfigured"
        | "server"
        | "declined";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const lineItems = sanitizeLineItems(input.lineItems);
  if (!lineItems) {
    return { error: "conflict", message: "Check the line items and amounts." };
  }

  const tipAmount = Math.round(Number(input.tipAmount ?? 0) * 100) / 100;
  if (!Number.isFinite(tipAmount) || tipAmount < 0 || tipAmount > 2000) {
    return { error: "conflict", message: "Enter a valid tip." };
  }

  const appointment = await fetchAppointmentAdminRecord(input.appointmentId);
  if (!appointment) return { error: "not_found" };

  if (input.kind === "service" && input.referralCode?.trim()) {
    const attached = await attachReferralOnBooking({
      referredCustomerId: appointment.customerId,
      appointmentId: input.appointmentId,
      code: input.referralCode,
    });
    if (!attached.ok) {
      return { error: "conflict", message: attached.message };
    }
  }

  const referralState = await getCollectReferralState({
    customerId: appointment.customerId,
    appointmentId: input.appointmentId,
    appointmentDate: appointment.appointmentDate,
    addressStreet: appointment.addressStreet,
    addressZip: appointment.addressZip,
    kind: input.kind,
  });
  const quote = buildCollectQuote({
    lineItems,
    tipAmount,
    availableCreditCents: referralState.availableCreditCents,
    mode: input.kind === "service" ? (input.referralMode ?? "none") : "none",
    customDollars: input.referralCustomDollars,
    applyNewClientDiscount:
      input.kind === "service" && referralState.applyNewClientDiscount,
  });

  const subtotal = Math.round(sumLineItems(lineItems) * 100) / 100;
  const newClientDiscount = centsToDollars(quote.discountCents);
  const referralCreditApplied = centsToDollars(quote.creditCents);
  const total = centsToDollars(quote.dueCents);
  const cents = quote.dueCents;
  if (cents > 0 && cents < 50) {
    return { error: "conflict", message: "The total must be at least $0.50." };
  }

  const admin = createAdminClient();
  const visitCollect =
    input.kind === "service" && appointment.visitId
      ? await loadVisitCollect(admin, appointment.visitId)
      : null;
  if (visitCollect && "error" in visitCollect) return { error: visitCollect.error };
  if (visitCollect && !("error" in visitCollect) && visitCollect.bill.blocked) {
    return {
      error: "conflict",
      message: visitCollect.bill.blockedMessage ?? "This visit is not ready to collect.",
    };
  }

  const visitId =
    visitCollect && !("error" in visitCollect) ? visitCollect.bill.visitId : null;
  const { data: existingCharges } = visitId
    ? await admin
        .from("appointment_charges")
        .select("id, appointment_id, status, kind, bill_snapshot, total, refunded_amount")
        .eq("visit_id", visitId)
        .eq("kind", "service")
    : await admin
        .from("appointment_charges")
        .select("id, appointment_id, status, kind, bill_snapshot, total, refunded_amount")
        .eq("appointment_id", input.appointmentId)
        .eq("kind", input.kind)
        .eq("status", "paid");

  if (visitId && input.kind === "service") {
    const decision = decideVisitServiceCharge(
      (existingCharges ?? []).map((row) => ({
        status: row.status as "pending" | "paid" | "failed",
        hasSnapshot: row.bill_snapshot != null,
        appointmentId: row.appointment_id as string,
        fullyRefunded: isFullyRefundedPayment(
          Number(row.total),
          Number(row.refunded_amount ?? 0),
        ),
      })),
    );
    if (decision === "already_paid" || decision === "legacy_paid") {
      return { error: "conflict", message: "This visit is already paid." };
    }
    if (decision === "in_progress") {
      return {
        error: "conflict",
        message: "A payment is already in progress. Please wait a moment and try again.",
      };
    }
  } else if (
    (existingCharges ?? []).some(
      (row) =>
        row.status === "paid" &&
        !isFullyRefundedPayment(Number(row.total), Number(row.refunded_amount ?? 0)),
    )
  ) {
    return { error: "conflict", message: "This appointment is already paid." };
  }

  const manualTender = isManualTender(input.tender);
  const useNewCard = !manualTender && Boolean(input.useNewCard);
  const tender: ChargeTender = manualTender
    ? input.tender === "zelle"
      ? "zelle"
      : "cash"
    : "card";
  const stripe = getStripe();
  if (cents > 0 && !manualTender && (!stripe || !isStripeConfigured())) {
    return { error: "misconfigured" };
  }

  let stripeCustomerId: string | null = null;
  if (cents > 0 && !manualTender) {
    stripeCustomerId = await getOrCreateStripeCustomerId(
      appointment.customerId,
      appointment.customerEmail,
    );
    if (!stripeCustomerId) return { error: "server" };
  }

  let stripePaymentMethodId: string | undefined;
  if (cents > 0 && !manualTender && !useNewCard) {
    if (!input.paymentMethodId) {
      return { error: "conflict", message: "Select a saved card." };
    }
    const { data: method } = await admin
      .from("payment_methods")
      .select("id, stripe_payment_method_id")
      .eq("id", input.paymentMethodId)
      .eq("customer_id", appointment.customerId)
      .maybeSingle();
    if (!method) {
      return { error: "conflict", message: "That card is no longer on file." };
    }
    stripePaymentMethodId = method.stripe_payment_method_id;
  }

  const billSnapshot =
    visitCollect && !("error" in visitCollect)
      ? chargedVisitSnapshot({
          bill: visitCollect.bill,
          lineItems,
          discount: newClientDiscount + referralCreditApplied,
          tip: tipAmount,
          total,
          paymentMethodLabel:
            tender === "cash" ? "Cash" : tender === "zelle" ? "Zelle" : null,
        })
      : null;

  if (
    !serviceChargeHasVisitBill({
      kind: input.kind,
      visitId,
      hasSnapshot: billSnapshot != null,
    })
  ) {
    return {
      error: "conflict",
      message: "This service payment must belong to the visit bill.",
    };
  }

  if (cents > 0 && !manualTender && !useNewCard) {
    if (!stripe || !stripeCustomerId || !stripePaymentMethodId || !input.paymentMethodId) {
      return { error: "server" };
    }
    return chargeSavedPaymentMethod({
      stripe,
      userId: session.user.id,
      customerId: appointment.customerId,
      petName: appointment.petName,
      visitId,
      billSnapshot,
      appointmentId: input.appointmentId,
      kind: input.kind,
      lineItems,
      subtotal,
      tipAmount,
      total,
      newClientDiscount,
      referralCreditApplied,
      creditCents: quote.creditCents,
      paymentMethodId: input.paymentMethodId,
      amountCents: cents,
      stripeCustomerId,
      stripePaymentMethodId,
    });
  }

  const { data: inserted, error: insertError } = await admin
    .from("appointment_charges")
    .insert({
      appointment_id: input.appointmentId,
      visit_id: visitId,
      kind: input.kind,
      status: "pending",
      line_items: lineItems,
      subtotal,
      tip_amount: tipAmount,
      total,
      new_client_discount: newClientDiscount,
      referral_credit_applied: referralCreditApplied,
      created_by: session.user.id,
      payment_method_id: manualTender || useNewCard ? null : input.paymentMethodId,
      tender,
      bill_snapshot: billSnapshot,
    })
    .select(CHARGE_SELECT)
    .single();

  if (insertError?.code === "23505") {
    return {
      error: "conflict",
      message: "A payment is already in progress. Please wait a moment and try again.",
    };
  }

  if (insertError || !inserted) {
    console.error("createAppointmentCharge insert failed:", insertError?.message);
    return { error: "server" };
  }

  if (quote.creditCents > 0) {
    const reserved = await reserveReferralCredit({
      customerId: appointment.customerId,
      chargeId: inserted.id,
      appointmentId: input.appointmentId,
      amountCents: quote.creditCents,
      adminUserId: session.user.id,
    });
    if (!reserved.ok) {
      await admin
        .from("appointment_charges")
        .update({ status: "failed" })
        .eq("id", inserted.id);
      return {
        error: "conflict",
        message: "That referral credit is no longer available.",
      };
    }
  }

  if (cents === 0 || manualTender) {
    const charge = await markChargePaid(
      inserted.id,
      manualTender || useNewCard ? null : input.paymentMethodId ?? null,
    );
    return { charge: charge ?? mapCharge(inserted as ChargeRow) };
  }

  if (!stripe || !stripeCustomerId) {
    await reverseReferralDebit(inserted.id);
    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    return { error: "server" };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: "usd",
      customer: stripeCustomerId,
      description:
        input.kind === "no_show"
          ? `K9 Atelier no-show · ${appointment.petName}`
          : visitId
            ? `K9 Atelier visit · ${visitCollect && !("error" in visitCollect) ? visitCollect.bill.customerName : appointment.customerName}`
            : `K9 Atelier grooming · ${appointment.petName}`,
      metadata: {
        appointment_id: input.appointmentId,
        ...(visitId ? { visit_id: visitId, customer_id: appointment.customerId } : {}),
        charge_id: inserted.id,
        kind: input.kind,
      },
      ...(useNewCard
        ? {
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: "never" as const,
            },
            setup_future_usage: "off_session" as const,
          }
        : {
            payment_method: stripePaymentMethodId,
            confirm: true,
            off_session: input.kind === "no_show",
          }),
    });

    await admin
      .from("appointment_charges")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", inserted.id);
    await attachReservationPaymentIntent(inserted.id, paymentIntent.id);

    if (paymentIntent.status === "succeeded") {
      const charge = await markChargePaid(
        inserted.id,
        useNewCard ? null : input.paymentMethodId ?? null,
      );
      return { charge: charge ?? mapCharge(inserted as ChargeRow) };
    }

    if (
      paymentIntent.status === "requires_action" ||
      paymentIntent.status === "requires_confirmation" ||
      useNewCard
    ) {
      if (!paymentIntent.client_secret) return { error: "server" };
      return {
        charge: mapCharge({
          ...(inserted as ChargeRow),
          stripe_payment_intent_id: paymentIntent.id,
        }),
        clientSecret: paymentIntent.client_secret,
        requiresAction: true,
      };
    }

    await reverseReferralDebit(inserted.id);
    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    return { error: "declined", message: "This card could not be charged." };
  } catch (error) {
    console.error("createAppointmentCharge stripe failed:", error);
    await reverseReferralDebit(inserted.id);
    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    return {
      error: "declined",
      message: customerFacingStripeMessage(error),
    };
  }
}

function chargeRowToAttempt(row: ChargeRow & { created_at?: string }): AttemptCharge {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    kind: row.kind,
    status: row.status,
    lineItems: row.line_items,
    subtotal: Number(row.subtotal),
    tipAmount: Number(row.tip_amount),
    total: Number(row.total),
    newClientDiscount: 0,
    referralCreditApplied: 0,
    paymentMethodId: row.payment_method_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    receiptChannel: row.receipt_channel,
    paidAt: row.paid_at,
    refundedAmount: Number(row.refunded_amount ?? 0),
    tender: readChargeTender(row.tender),
  };
}

function attemptToRecord(charge: AttemptCharge): AppointmentChargeRecord {
  return {
    id: charge.id,
    appointmentId: charge.appointmentId,
    kind: charge.kind,
    status: charge.status,
    lineItems: charge.lineItems,
    subtotal: charge.subtotal,
    tipAmount: charge.tipAmount,
    total: charge.total,
    receiptChannel: charge.receiptChannel,
    paidAt: charge.paidAt,
    refundedAmount: charge.refundedAmount,
    paymentMethodId: charge.paymentMethodId,
    tender: charge.tender,
  };
}

async function chargeSavedPaymentMethod(input: {
  stripe: NonNullable<ReturnType<typeof getStripe>>;
  userId: string;
  customerId: string;
  petName: string;
  visitId: string | null;
  billSnapshot: VisitBillSnapshot | null;
  appointmentId: string;
  kind: ChargeKind;
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipAmount: number;
  total: number;
  newClientDiscount: number;
  referralCreditApplied: number;
  creditCents: number;
  paymentMethodId: string;
  amountCents: number;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
}): Promise<
  | {
      charge: AppointmentChargeRecord;
      clientSecret?: string;
      requiresAction?: boolean;
    }
  | {
      error: "conflict" | "declined" | "server";
      message?: string;
    }
> {
  const admin = createAdminClient();
  const select = `${CHARGE_SELECT}, created_at`;
  const result = await attemptSavedCardCharge(
    {
      appointmentId: input.appointmentId,
      kind: input.kind,
      lineItems: input.lineItems,
      subtotal: input.subtotal,
      tipAmount: input.tipAmount,
      total: input.total,
      newClientDiscount: input.newClientDiscount,
      referralCreditApplied: input.referralCreditApplied,
      creditCents: input.creditCents,
      createdBy: input.userId,
      paymentMethodId: input.paymentMethodId,
      amountCents: input.amountCents,
      stripeCustomerId: input.stripeCustomerId,
      stripePaymentMethodId: input.stripePaymentMethodId,
      offSession: input.kind === "no_show",
      description:
        input.kind === "no_show"
          ? `K9 Atelier no-show · ${input.petName}`
          : input.visitId
            ? `K9 Atelier visit · ${input.billSnapshot?.customerName || input.petName}`
            : `K9 Atelier grooming · ${input.petName}`,
      visitId: input.visitId,
      customerId: input.customerId,
    },
    {
      findPaid: async () => {
        const query = admin
          .from("appointment_charges")
          .select(select)
          .eq("kind", input.kind)
          .eq("status", "paid");
        if (input.visitId) {
          const { data, error } = await query.eq("visit_id", input.visitId);
          if (error) {
            console.error("chargeSavedPaymentMethod paid lookup failed:", error.message);
            throw error;
          }
          const rows = (data ?? []) as Array<ChargeRow & { created_at?: string }>;
          const active = rows.filter(
            (item) =>
              !isFullyRefundedPayment(Number(item.total), Number(item.refunded_amount ?? 0)),
          );
          const row = active.find((item) => item.bill_snapshot != null) ?? active[0];
          return row ? chargeRowToAttempt(row) : null;
        }
        const { data, error } = await query
          .eq("appointment_id", input.appointmentId)
          .maybeSingle();
        if (error) {
          console.error("chargeSavedPaymentMethod paid lookup failed:", error.message);
          throw error;
        }
        return data
          ? chargeRowToAttempt(data as ChargeRow & { created_at?: string })
          : null;
      },
      findLatestPending: async () => {
        const query = admin
          .from("appointment_charges")
          .select(select)
          .eq("kind", input.kind)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (input.visitId) {
          const { data, error } = await query.eq("visit_id", input.visitId);
          if (error) {
            console.error(
              "chargeSavedPaymentMethod pending lookup failed:",
              error.message,
            );
            throw error;
          }
          const rows = (data ?? []) as Array<ChargeRow & { created_at?: string }>;
          const row = rows.find((item) => item.bill_snapshot != null);
          return row ? chargeRowToAttempt(row) : null;
        }
        const { data, error } = await query
          .eq("appointment_id", input.appointmentId)
          .limit(1);
        if (error) {
          console.error(
            "chargeSavedPaymentMethod pending lookup failed:",
            error.message,
          );
          throw error;
        }
        const row = data?.[0] as (ChargeRow & { created_at?: string }) | undefined;
        return row ? chargeRowToAttempt(row) : null;
      },
      insertPending: async (row) => {
        const { data, error } = await admin
          .from("appointment_charges")
          .insert({
            ...row,
            visit_id: input.visitId,
            bill_snapshot: input.billSnapshot,
          })
          .select(select)
          .single();
        if (error || !data) {
          console.error("createAppointmentCharge insert failed:", error?.message);
          throw error ?? new Error("insert failed");
        }
        return chargeRowToAttempt(data as ChargeRow & { created_at?: string });
      },
      linkPaymentIntent: async (chargeId, paymentIntentId) => {
        const { error } = await admin
          .from("appointment_charges")
          .update({ stripe_payment_intent_id: paymentIntentId })
          .eq("id", chargeId);
        if (error) {
          console.error("chargeSavedPaymentMethod link intent failed:", error.message);
          throw error;
        }
        await attachReservationPaymentIntent(chargeId, paymentIntentId);
      },
      markPaid: async (chargeId, paymentMethodId) => {
        const paid = await markChargePaid(chargeId, paymentMethodId);
        if (!paid) return null;
        const { data } = await admin
          .from("appointment_charges")
          .select(select)
          .eq("id", chargeId)
          .maybeSingle();
        return data
          ? chargeRowToAttempt(data as ChargeRow & { created_at?: string })
          : chargeRowToAttempt({
              id: paid.id,
              appointment_id: paid.appointmentId,
              kind: paid.kind,
              status: paid.status,
              line_items: paid.lineItems,
              subtotal: paid.subtotal,
              tip_amount: paid.tipAmount,
              total: paid.total,
              receipt_channel: paid.receiptChannel,
              paid_at: paid.paidAt,
              stripe_payment_intent_id: null,
              refunded_amount: paid.refundedAmount,
              payment_method_id: paid.paymentMethodId ?? null,
              tender: paid.tender ?? "card",
            });
      },
      markFailed: async (chargeId) => {
        await reverseReferralDebit(chargeId);
        await admin
          .from("appointment_charges")
          .update({ status: "failed" })
          .eq("id", chargeId);
      },
      reserveCredit: async (chargeId) => {
        const reserved = await reserveReferralCredit({
          customerId: input.customerId,
          chargeId,
          appointmentId: input.appointmentId,
          amountCents: input.creditCents,
          adminUserId: input.userId,
        });
        if (!reserved.ok) {
          return {
            ok: false,
            message: "That referral credit is no longer available.",
          };
        }
        return { ok: true };
      },
      createPaymentIntent: async (params, options) => {
        const paymentIntent = await input.stripe.paymentIntents.create(params, {
          idempotencyKey: options.idempotencyKey || savedCardIdempotencyKey(params.metadata.charge_id),
        });
        return {
          id: paymentIntent.id,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret,
        };
      },
      retrievePaymentIntent: async (id) => {
        const paymentIntent = await input.stripe.paymentIntents.retrieve(id);
        return {
          id: paymentIntent.id,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret,
        };
      },
    },
  );

  if (!result.ok) {
    if (result.stripeError) {
      console.error("createAppointmentCharge stripe failed:", result.stripeError);
    }
    return { error: result.error, message: result.message };
  }

  return {
    charge: attemptToRecord(result.charge),
    ...(result.requiresAction
      ? { clientSecret: result.clientSecret, requiresAction: true as const }
      : {}),
  };
}

export async function confirmAppointmentCharge(
  chargeId: string,
  paymentIntentId: string,
): Promise<
  | { charge: AppointmentChargeRecord }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const stripe = getStripe();
  if (!stripe) return { error: "server" };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointment_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    console.error("confirmAppointmentCharge load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };
  if (row.status === "paid") return { charge: mapCharge(row as ChargeRow) };

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (retrieveError) {
    console.error("confirmAppointmentCharge retrieve failed:", retrieveError);
    return { error: "server" };
  }

  if (paymentIntent.id !== row.stripe_payment_intent_id) return { error: "conflict" };
  if (paymentIntent.status !== "succeeded") return { error: "conflict" };

  const paymentMethodId =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id;

  let savedMethodId: string | null = null;
  if (paymentMethodId) {
    const appointment = await fetchAppointmentAdminRecord(row.appointment_id);
    if (appointment) {
      savedMethodId = await saveChargedPaymentMethod(
        appointment.customerId,
        paymentMethodId,
      );
    }
  }

  const charge = await markChargePaid(chargeId, savedMethodId);
  if (!charge) return { error: "server" };
  return { charge };
}

async function saveChargedPaymentMethod(
  customerId: string,
  stripePaymentMethodId: string,
) {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
    const card = paymentMethod.card;
    if (!card) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("payment_methods")
      .upsert(
        {
          customer_id: customerId,
          stripe_payment_method_id: paymentMethod.id,
          brand: card.brand ?? "card",
          last4: card.last4 ?? "0000",
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          is_default: false,
        },
        { onConflict: "stripe_payment_method_id" },
      )
      .select("id")
      .single();
    return (data?.id as string | undefined) ?? null;
  } catch (error) {
    console.error("saveChargedPaymentMethod failed:", error);
    return null;
  }
}

async function markChargePaid(
  chargeId: string,
  paymentMethodId: string | null,
): Promise<AppointmentChargeRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointment_charges")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    })
    .eq("id", chargeId)
    .select(CHARGE_SELECT)
    .single();

  if (error || !data) {
    console.error("markChargePaid failed:", error?.message);
    return null;
  }

  const charge = mapCharge(data as ChargeRow);
  if (charge.billSnapshot) {
    let paymentMethodLabel = charge.billSnapshot.paymentMethodLabel ?? null;
    if (!paymentMethodLabel && paymentMethodId) {
      const { data: method } = await admin
        .from("payment_methods")
        .select("brand, last4")
        .eq("id", paymentMethodId)
        .maybeSingle();
      paymentMethodLabel = formatReceiptPaymentMethod(
        method?.last4
          ? {
              id: paymentMethodId,
              brand: String(method.brand ?? "card"),
              last4: String(method.last4),
              expMonth: 1,
              expYear: 2099,
              isDefault: false,
            }
          : null,
      );
    }
    await admin
      .from("appointment_charges")
      .update({
        bill_snapshot: {
          ...charge.billSnapshot,
          paidAt: charge.paidAt,
          tip: charge.tipAmount,
          total: charge.total,
          paymentMethodLabel,
        },
      })
      .eq("id", chargeId);
  }
  await confirmReferralDebit(chargeId);
  try {
    const issued = await issueReferralRewardForPaidCharge(chargeId);
    if (issued.status === "needs_recovery") {
      console.error(
        "issueReferralRewardForPaidCharge needs recovery:",
        issued.reason,
        chargeId,
      );
    }
  } catch (issueError) {
    console.error("issueReferralRewardForPaidCharge failed:", issueError);
  }
  try {
    const appointment = await fetchAppointmentAdminRecord(charge.appointmentId);
    if (appointment) {
      const petCount = charge.billSnapshot?.pets.length ?? 0;
      await sendAfterVisitThankYouSms(
        petCount > 1 ? { ...appointment, petName: "your pets" } : appointment,
      );
    }
  } catch (smsError) {
    console.error("after-visit thank-you SMS failed:", smsError);
  }
  return charge;
}

export async function sendChargeReceipt(
  chargeId: string,
): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointment_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    console.error("sendChargeReceipt load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };
  if (row.status !== "paid") return { error: "conflict" };

  const appointment = await fetchAppointmentAdminRecord(row.appointment_id);
  if (!appointment) return { error: "not_found" };

  const charge = mapCharge(row as ChargeRow);
  const sent = await sendChargeReceiptEmail(
    appointment,
    charge,
    charge.billSnapshot?.paymentMethodLabel,
  );

  if (!sent) return { error: "server" };

  await admin
    .from("appointment_charges")
    .update({
      receipt_channel: "email",
      receipt_sent_at: new Date().toISOString(),
    })
    .eq("id", chargeId);

  return { ok: true };
}

export function noShowLineItemsFor(appointment: CollectContext["appointment"]) {
  return buildNoShowLineItems(appointment);
}

export async function refundAppointmentCharge(
  chargeId: string,
  amount: number,
): Promise<
  | { charge: AppointmentChargeRecord }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "misconfigured"
        | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const refundAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return { error: "conflict", message: "Enter a refund amount." };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointment_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    console.error("refundAppointmentCharge load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };
  if (row.status !== "paid") {
    return { error: "conflict", message: "This payment cannot be refunded." };
  }

  const manualRefund = isManualTender(readChargeTender(row.tender));
  if (!manualRefund && !row.stripe_payment_intent_id) {
    return { error: "conflict", message: "This payment cannot be refunded." };
  }

  const alreadyRefunded = Number(row.refunded_amount ?? 0);
  const remaining = Math.round((Number(row.total) - alreadyRefunded) * 100) / 100;
  if (refundAmount > remaining) {
    return {
      error: "conflict",
      message: `At most ${remaining.toFixed(2)} can be refunded.`,
    };
  }

  if (!manualRefund) {
    const stripe = getStripe();
    if (!stripe) return { error: "misconfigured" };
    try {
      await stripe.refunds.create({
        payment_intent: row.stripe_payment_intent_id as string,
        amount: dollarsToCents(refundAmount),
      });
    } catch (refundError) {
      console.error("refundAppointmentCharge stripe failed:", refundError);
      return { error: "conflict", message: "Stripe could not process this refund." };
    }
  }

  const nextRefunded = Math.round((alreadyRefunded + refundAmount) * 100) / 100;
  const { data: updated, error: updateError } = await admin
    .from("appointment_charges")
    .update({
      refunded_amount: nextRefunded,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", chargeId)
    .select(CHARGE_SELECT)
    .single();

  if (updateError) {
    console.error("refundAppointmentCharge save failed:", updateError.message);
  }

  const { data: appointment } = await admin
    .from("appointments")
    .select("id, customer_id, appointment_date, address_street, address_zip")
    .eq("id", row.appointment_id)
    .maybeSingle();
  const visitKey = appointment
    ? householdVisitKey({
        customerId: appointment.customer_id as string,
        appointmentDate: appointment.appointment_date as string,
        addressStreet: appointment.address_street as string,
        addressZip: appointment.address_zip as string,
      })
    : null;
  const [{ data: byCharge }, { data: byVisit }] = await Promise.all([
    admin
      .from("referral_reward_sources")
      .select("id, status, referrer_customer_id")
      .eq("source_charge_id", chargeId),
    visitKey
      ? admin
          .from("referral_reward_sources")
          .select("id, status, referrer_customer_id")
          .eq("visit_key", visitKey)
      : Promise.resolve({ data: [] as Array<{
          id: string;
          status: string;
          referrer_customer_id: string;
        }> }),
  ]);
  const sources = [
    ...(byCharge ?? []),
    ...(byVisit ?? []).filter(
      (row) => !(byCharge ?? []).some((chargeRow) => chargeRow.id === row.id),
    ),
  ];
  for (const source of sources ?? []) {
    if (source.status === "cancelled") continue;
    await admin
      .from("referral_reward_sources")
      .update({ status: "under_review", updated_at: new Date().toISOString() })
      .eq("id", source.id);
    await writeReferralAudit({
      adminUserId: session.user.id,
      action: "reward_under_review_after_refund",
      rewardSourceId: source.id as string,
      customerId: source.referrer_customer_id as string,
      previousValue: { status: source.status },
      newValue: { status: "under_review", refunded: nextRefunded },
      reason: "A related visit charge was refunded.",
    });
  }

  return {
    charge: mapCharge(
      (updated ?? {
        ...(row as ChargeRow),
        refunded_amount: nextRefunded,
      }) as ChargeRow,
    ),
  };
}
