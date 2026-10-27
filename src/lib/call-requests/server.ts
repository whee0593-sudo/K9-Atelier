import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase/env";
import { getStripe } from "@/lib/stripe/server";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/stripe/config";
import { clientIp, consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { assertSameOrigin, callContact, CallRequestError, CALL_REQUEST_CONSENT_VERSION, completeStoredCallRequest, smallJson } from "./core";

export const CALL_COOKIE = "k9-call-request";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export type CallRequestRow = {
  id: string; status: "draft" | "requested" | "contacted"; name: string | null; phone: string | null;
  expires_at: string; stripe_customer_id: string | null; stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null; consent_at: string | null; consent_version: string | null;
  card_brand: string | null; card_last4: string | null; requested_at: string | null;
};

export function callRequestsConfigured() {
  return process.env.CALL_REQUESTS_ENABLED === "true" && hasSupabaseConfig() && hasSupabaseAdminConfig() && isStripeConfigured();
}
export function callJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export async function publicCallAction(request: Request, action: (body: Record<string, unknown>) => Promise<NextResponse>) {
  try {
    assertSameOrigin(request);
    const url = new URL(request.url);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new CallRequestError("Please use our secure website.", 403);
    const rate = consumeRateLimit({ key: `call-request:${clientIp(request)}`, limit: 30, windowMs: 10 * 60 * 1000 });
    if (!rate.ok) return rateLimitResponse(rate.retryAfterSec);
    if (!callRequestsConfigured()) throw new CallRequestError("Card setup is temporarily unavailable. Please call us.", 503);
    return await action(await smallJson(request));
  } catch (error) {
    if (error instanceof CallRequestError) return callJson({ error: error.message }, error.status);
    console.error("Call request operation failed");
    return callJson({ error: "We could not save your request. Please try again or call us." }, 503);
  }
}
export async function findCallSession(request: Request): Promise<CallRequestRow | null> {
  const token = request.headers.get("cookie")?.split(";").map(p => p.trim()).find(p => p.startsWith(`${CALL_COOKIE}=`))?.slice(CALL_COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await createAdminClient().from("call_requests").select("*").eq("token_hash", hash(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("call_session_read_failed");
  return data as CallRequestRow | null;
}
export async function requireCallSession(request: Request) {
  const row = await findCallSession(request);
  if (!row) throw new CallRequestError("This session has expired. Please start again.", 401);
  return row;
}
export const publicCallState = (row: CallRequestRow | null) => row ? {
  status: row.status, name: row.name ?? "", phone: row.phone ?? "", hasSetup: Boolean(row.stripe_setup_intent_id),
} : { status: "empty", name: "", phone: "", hasSetup: false };

export async function createCallSession(request: Request, reset: boolean) {
  const existing = !reset ? await findCallSession(request) : null;
  if (existing) return callJson(publicCallState(existing));
  const token = randomBytes(32).toString("hex");
  const { data, error } = await createAdminClient().rpc("create_call_request_draft", { p_token_hash: hash(token), p_ip_hash: hash(clientIp(request)) });
  if (error) {
    if (error.message.includes("call_request_rate_limit")) throw new CallRequestError("Too many requests. Please try again later or call us.", 429);
    throw new Error("call_session_create_failed");
  }
  if (!data) throw new Error("call_session_create_failed");
  const response = callJson({ ...publicCallState(null), status: "draft" });
  response.cookies.set(CALL_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:", sameSite: "strict", path: "/api/call-requests", maxAge: 3600 });
  return response;
}

export async function prepareCallCard(request: Request, body: unknown) {
  const contact = callContact(body);
  let row = await requireCallSession(request);
  if (row.status !== "draft") return callJson({ received: true });
  // Freeze contact data once initialization begins, including concurrent attempts.
  if (!row.consent_at) {
    const { error } = await createAdminClient().from("call_requests").update({ ...contact, consent_at: new Date().toISOString(), consent_version: CALL_REQUEST_CONSENT_VERSION })
      .eq("id", row.id).eq("status", "draft").is("consent_at", null);
    if (error) throw new Error("call_contact_write_failed");
    row = await requireCallSession(request);
  }
  if (row.name !== contact.name || row.phone !== contact.phone || !row.consent_at) throw new CallRequestError("Please start again to change your contact details.", 409);
  const stripe = getStripe();
  if (!stripe) throw new Error("stripe_unavailable");
  // Stable keys allow recovery if Stripe succeeds before a database write fails.
  const customer = row.stripe_customer_id ? { id: row.stripe_customer_id } : await stripe.customers.create({ name: contact.name, phone: contact.phone, metadata: { call_request_id: row.id } }, { idempotencyKey: `call:${row.id}:customer` });
  const setup = row.stripe_setup_intent_id ? await stripe.setupIntents.retrieve(row.stripe_setup_intent_id) : await stripe.setupIntents.create({ customer: customer.id, payment_method_types: ["card"], usage: "off_session", metadata: { call_request_id: row.id } }, { idempotencyKey: `call:${row.id}:setup` });
  if (!setup.client_secret) throw new Error("missing_setup_secret");
  const { error } = await createAdminClient().from("call_requests").update({ stripe_customer_id: customer.id, stripe_setup_intent_id: setup.id }).eq("id", row.id).eq("status", "draft");
  if (error) throw new Error("call_setup_write_failed");
  return callJson({ ...contact, clientSecret: setup.client_secret, publishableKey: getStripePublishableKey(), readyToComplete: setup.status === "succeeded" });
}

export async function completeCallRequest(request: Request) {
  const row = await requireCallSession(request);
  const stripe = getStripe();
  await completeStoredCallRequest(row, {
    loadSetup: async id => { if (!stripe) throw new Error("stripe_unavailable"); return stripe.setupIntents.retrieve(id); },
    loadMethod: async id => { if (!stripe) throw new Error("stripe_unavailable"); return stripe.paymentMethods.retrieve(id); },
    persist: async card => {
      const { data, error } = await createAdminClient().from("call_requests").update({ ...card, status: "requested", requested_at: new Date().toISOString() }).eq("id", row.id).eq("status", "draft").select("id").maybeSingle();
      if (error) throw new Error("call_complete_write_failed");
      return Boolean(data);
    },
    alreadyReceived: async () => (await requireCallSession(request)).status !== "draft",
    notify: async () => { const { sendCallRequestNotice } = await import("./notices"); await sendCallRequestNotice(row.id); },
  });
  return callJson({ received: true });
}
