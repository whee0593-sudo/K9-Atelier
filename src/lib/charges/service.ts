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
import { dollarsToCents, sumLineItems } from "@/lib/charges/money";
import type {
  AppointmentChargeRecord,
  ChargeKind,
  ChargeLineItem,
  CollectContext,
  CreateChargeInput,
  ReceiptChannel,
} from "@/lib/charges/types";
import { sendChargeReceiptEmail, sendChargeReceiptSms } from "@/lib/charges/receipts";

type ChargeRow = {
  id: string;
  appointment_id: string;
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
};

function mapCharge(row: ChargeRow & { refunded_amount?: number | null }): AppointmentChargeRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    kind: row.kind,
    status: row.status,
    lineItems: row.line_items,
    subtotal: Number(row.subtotal),
    tipAmount: Number(row.tip_amount),
    total: Number(row.total),
    receiptChannel: row.receipt_channel,
    paidAt: row.paid_at,
    refundedAmount: Number(row.refunded_amount ?? 0),
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

  const { data: charges, error: chargeError } = await admin
    .from("appointment_charges")
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, refunded_amount",
    )
    .eq("appointment_id", appointmentId)
    .eq("status", "paid");

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
    .select("service_started_at, service_ended_at")
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

  return {
    context: {
      appointment: appointmentWithTiming,
      petWeightLbs: weightLbs,
      lineItems: buildDefaultLineItems(appointment, weightLbs),
      catalog: catalogChargeItems(weightLbs),
      catalogGroups: catalogChargeGroups(weightLbs),
      methods: methods.methods,
      selectedPaymentMethodId,
      paidKinds: (charges ?? []).map((row) => row.kind as ChargeKind),
      paidCharges: (charges ?? []).map((row) => mapCharge(row as ChargeRow)),
      stripeConfigured: isStripeConfigured(),
      stripePublishableKey: getStripePublishableKey(),
    },
  };
}

export async function listPaidKindsByAppointment(
  appointmentIds: string[],
): Promise<Record<string, ChargeKind[]>> {
  if (appointmentIds.length === 0) return {};
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointment_charges")
    .select("appointment_id, kind")
    .in("appointment_id", appointmentIds)
    .eq("status", "paid");

  if (error) {
    console.error("listPaidKindsByAppointment failed:", error.message);
    return {};
  }

  const map: Record<string, ChargeKind[]> = {};
  for (const row of data ?? []) {
    const id = row.appointment_id as string;
    const kind = row.kind as ChargeKind;
    map[id] = [...(map[id] ?? []), kind];
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

  const subtotal = Math.round(sumLineItems(lineItems) * 100) / 100;
  const total = Math.round((subtotal + tipAmount) * 100) / 100;
  const cents = dollarsToCents(total);
  if (cents < 50) {
    return { error: "conflict", message: "The total must be at least $0.50." };
  }

  const appointment = await fetchAppointmentAdminRecord(input.appointmentId);
  if (!appointment) return { error: "not_found" };

  const admin = createAdminClient();
  const { data: paid } = await admin
    .from("appointment_charges")
    .select("id, kind")
    .eq("appointment_id", input.appointmentId)
    .eq("status", "paid")
    .eq("kind", input.kind)
    .maybeSingle();

  if (paid) {
    return { error: "conflict", message: "This appointment is already paid." };
  }

  const stripe = getStripe();
  if (!stripe || !isStripeConfigured()) return { error: "misconfigured" };

  const stripeCustomerId = await getOrCreateStripeCustomerId(
    appointment.customerId,
    appointment.customerEmail,
  );
  if (!stripeCustomerId) return { error: "server" };

  let stripePaymentMethodId: string | undefined;
  if (!input.useNewCard) {
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

  const { data: inserted, error: insertError } = await admin
    .from("appointment_charges")
    .insert({
      appointment_id: input.appointmentId,
      kind: input.kind,
      status: "pending",
      line_items: lineItems,
      subtotal,
      tip_amount: tipAmount,
      total,
      created_by: session.user.id,
      payment_method_id: input.useNewCard ? null : input.paymentMethodId,
    })
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id",
    )
    .single();

  if (insertError || !inserted) {
    console.error("createAppointmentCharge insert failed:", insertError?.message);
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
          : `K9 Atelier grooming · ${appointment.petName}`,
      metadata: {
        appointment_id: input.appointmentId,
        charge_id: inserted.id,
        kind: input.kind,
      },
      ...(input.useNewCard
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

    if (paymentIntent.status === "succeeded") {
      const charge = await markChargePaid(
        inserted.id,
        input.useNewCard ? null : input.paymentMethodId ?? null,
      );
      return { charge: charge ?? mapCharge(inserted as ChargeRow) };
    }

    if (
      paymentIntent.status === "requires_action" ||
      paymentIntent.status === "requires_confirmation" ||
      input.useNewCard
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

    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    return { error: "declined", message: "This card could not be charged." };
  } catch (error) {
    console.error("createAppointmentCharge stripe failed:", error);
    await admin
      .from("appointment_charges")
      .update({ status: "failed" })
      .eq("id", inserted.id);
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "This card could not be charged.";
    return { error: "declined", message };
  }
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
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id",
    )
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
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id",
    )
    .single();

  if (error || !data) {
    console.error("markChargePaid failed:", error?.message);
    return null;
  }
  return mapCharge(data as ChargeRow);
}

export async function sendChargeReceipt(
  chargeId: string,
  channel: ReceiptChannel,
): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointment_charges")
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id",
    )
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
  const sent =
    channel === "email"
      ? await sendChargeReceiptEmail(appointment, charge)
      : await sendChargeReceiptSms(appointment, charge);

  if (!sent) return { error: "server" };

  await admin
    .from("appointment_charges")
    .update({
      receipt_channel: channel,
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

  const stripe = getStripe();
  if (!stripe) return { error: "misconfigured" };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("appointment_charges")
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id, refunded_amount",
    )
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    console.error("refundAppointmentCharge load failed:", error.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };
  if (row.status !== "paid" || !row.stripe_payment_intent_id) {
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

  try {
    await stripe.refunds.create({
      payment_intent: row.stripe_payment_intent_id,
      amount: dollarsToCents(refundAmount),
    });
  } catch (refundError) {
    console.error("refundAppointmentCharge stripe failed:", refundError);
    return { error: "conflict", message: "Stripe could not process this refund." };
  }

  const nextRefunded = Math.round((alreadyRefunded + refundAmount) * 100) / 100;
  const { data: updated, error: updateError } = await admin
    .from("appointment_charges")
    .update({
      refunded_amount: nextRefunded,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", chargeId)
    .select(
      "id, appointment_id, kind, status, line_items, subtotal, tip_amount, total, receipt_channel, paid_at, stripe_payment_intent_id, refunded_amount",
    )
    .single();

  if (updateError) {
    console.error("refundAppointmentCharge save failed:", updateError.message);
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
