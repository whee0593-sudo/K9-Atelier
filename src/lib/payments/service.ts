import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/pets/auth";
import { getStripe } from "@/lib/stripe/server";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/stripe/config";
import {
  mapPaymentMethodRow,
  type PaymentMethodRecord,
  type PaymentMethodRow,
} from "@/lib/payments/types";

const PAYMENT_METHOD_SELECT =
  "id, customer_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default";

export async function listCustomerPaymentMethods(): Promise<
  | { methods: PaymentMethodRecord[]; configured: boolean }
  | { error: "unauthenticated" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select(PAYMENT_METHOD_SELECT)
    .eq("customer_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listCustomerPaymentMethods failed:", error.message);
    return { error: "server" };
  }

  return {
    methods: ((data ?? []) as PaymentMethodRow[]).map(mapPaymentMethodRow),
    configured: isStripeConfigured(),
  };
}

export async function customerHasPaymentMethod(
  customerId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);

  if (error) {
    console.error("customerHasPaymentMethod failed:", error.message);
    return false;
  }

  return (count ?? 0) > 0;
}

export async function getCustomerPaymentMethod(
  customerId: string,
  paymentMethodId: string,
): Promise<PaymentMethodRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_methods")
    .select(PAYMENT_METHOD_SELECT)
    .eq("id", paymentMethodId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("getCustomerPaymentMethod failed:", error.message);
    return null;
  }
  if (!data) return null;
  return mapPaymentMethodRow(data as PaymentMethodRow);
}

async function getOrCreateStripeCustomerId(userId: string, email: string | undefined) {
  const stripe = getStripe();
  if (!stripe) return null;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("getOrCreateStripeCustomerId profile failed:", profileError.message);
    return null;
  }

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: profile?.email ?? email,
    metadata: { supabase_user_id: userId },
  });

  const { error: updateError } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    console.error("getOrCreateStripeCustomerId save failed:", updateError.message);
    return null;
  }

  return customer.id;
}

export async function createSetupIntent(): Promise<
  | { clientSecret: string; publishableKey: string }
  | { error: "unauthenticated" | "misconfigured" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const stripe = getStripe();
  const publishableKey = getStripePublishableKey();
  if (!stripe || !publishableKey) return { error: "misconfigured" };

  const customerId = await getOrCreateStripeCustomerId(user.id, user.email);
  if (!customerId) return { error: "server" };

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
    });

    if (!setupIntent.client_secret) return { error: "server" };

    return {
      clientSecret: setupIntent.client_secret,
      publishableKey,
    };
  } catch (error) {
    console.error("createSetupIntent failed:", error);
    return { error: "server" };
  }
}

export async function saveSetupIntentPaymentMethod(
  setupIntentId: string,
): Promise<
  | { method: PaymentMethodRecord }
  | { error: "unauthenticated" | "misconfigured" | "conflict" | "server" }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const stripe = getStripe();
  if (!stripe) return { error: "misconfigured" };

  let setupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch (error) {
    console.error("saveSetupIntentPaymentMethod retrieve failed:", error);
    return { error: "server" };
  }

  if (setupIntent.status !== "succeeded") return { error: "conflict" };

  const stripeCustomerId = await getOrCreateStripeCustomerId(user.id, user.email);
  const setupCustomerId =
    typeof setupIntent.customer === "string"
      ? setupIntent.customer
      : setupIntent.customer && "id" in setupIntent.customer
        ? setupIntent.customer.id
        : null;
  if (!stripeCustomerId || setupCustomerId !== stripeCustomerId) {
    return { error: "conflict" };
  }

  const paymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;
  if (!paymentMethodId) return { error: "conflict" };

  let paymentMethod;
  try {
    paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch (error) {
    console.error("saveSetupIntentPaymentMethod pm failed:", error);
    return { error: "server" };
  }

  const card = paymentMethod.card;
  if (!card) return { error: "conflict" };

  const admin = createAdminClient();
  const { data: existingRow } = await admin
    .from("payment_methods")
    .select("id, is_default")
    .eq("stripe_payment_method_id", paymentMethod.id)
    .maybeSingle();
  const hasExisting = await customerHasPaymentMethod(user.id);

  const { data, error } = await admin
    .from("payment_methods")
    .upsert(
      {
        customer_id: user.id,
        stripe_payment_method_id: paymentMethod.id,
        brand: card.brand ?? "card",
        last4: card.last4 ?? "0000",
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        is_default: existingRow?.is_default ?? !hasExisting,
      },
      { onConflict: "stripe_payment_method_id" },
    )
    .select(PAYMENT_METHOD_SELECT)
    .single();

  if (error) {
    console.error("saveSetupIntentPaymentMethod insert failed:", error.message);
    return { error: "server" };
  }

  return { method: mapPaymentMethodRow(data as PaymentMethodRow) };
}

export async function deleteCustomerPaymentMethod(
  paymentMethodId: string,
): Promise<{ ok: true } | { error: "unauthenticated" | "not_found" | "conflict" | "server" }> {
  const user = await requireAuthenticatedUser();
  if (!user) return { error: "unauthenticated" };

  const admin = createAdminClient();
  const { data: row, error: loadError } = await admin
    .from("payment_methods")
    .select("id, stripe_payment_method_id, is_default")
    .eq("id", paymentMethodId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (loadError) {
    console.error("deleteCustomerPaymentMethod load failed:", loadError.message);
    return { error: "server" };
  }
  if (!row) return { error: "not_found" };

  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("payment_method_id", paymentMethodId)
    .in("status", ["pending_confirmation", "confirmed"]);

  if ((count ?? 0) > 0) return { error: "conflict" };

  const stripe = getStripe();
  if (stripe) {
    try {
      await stripe.paymentMethods.detach(row.stripe_payment_method_id);
    } catch (error) {
      console.error("deleteCustomerPaymentMethod detach failed:", error);
    }
  }

  const { error: deleteError } = await admin
    .from("payment_methods")
    .delete()
    .eq("id", paymentMethodId)
    .eq("customer_id", user.id);

  if (deleteError) {
    console.error("deleteCustomerPaymentMethod delete failed:", deleteError.message);
    return { error: "server" };
  }

  if (row.is_default) {
    const { data: next } = await admin
      .from("payment_methods")
      .select("id")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await admin
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", next.id);
    }
  }

  return { ok: true };
}
