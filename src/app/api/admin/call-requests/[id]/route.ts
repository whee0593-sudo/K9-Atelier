import { getOwnerSession, getStaffSession } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin, CallRequestError, smallJson, verifiedCallCard } from "@/lib/call-requests/core";
import { callJson } from "@/lib/call-requests/server";
import { getStripe } from "@/lib/stripe/server";
import { isValidEmail } from "@/lib/support-contact";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const body = await smallJson(request);
    const session = body.action === "link" ? await getOwnerSession() : await getStaffSession();
    if ("error" in session) return callJson({ error: "Staff access required." }, session.error === "unauthenticated" ? 401 : 403);
    const { id } = await context.params;
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new CallRequestError("Invalid request.");
    const admin = createAdminClient();
    if (body.action === "contacted") {
      const { error } = await admin.from("call_requests").update({ status: "contacted", contacted_at: new Date().toISOString() }).eq("id", id).eq("status", "requested");
      if (error) throw new Error();
    } else if (body.action === "link" && typeof body.customerEmail === "string" && isValidEmail(body.customerEmail.trim())) {
      const { data: row, error: readError } = await admin.from("call_requests").select("id,status,linked_customer_id,stripe_customer_id,stripe_setup_intent_id").eq("id", id).neq("status", "draft").single();
      if (readError || !row) throw new Error();
      if (!row.linked_customer_id) {
        const stripe = getStripe();
        if (!stripe || !row.stripe_setup_intent_id) throw new Error();
        const setup = await stripe.setupIntents.retrieve(row.stripe_setup_intent_id);
        const methodId = typeof setup.payment_method === "string" ? setup.payment_method : setup.payment_method?.id;
        if (!methodId) throw new CallRequestError("This card is no longer available. Please review the request.", 409);
        verifiedCallCard(row, setup, await stripe.paymentMethods.retrieve(methodId));
      }
      const { error } = await admin.rpc("link_call_request_customer", { p_request_id: id, p_customer_email: body.customerEmail.trim() });
      if (error) return callJson({ error: "Card not linked. Check that the customer profile exists and has no different saved-card account. No existing cards were replaced." }, 409);
    } else throw new CallRequestError("Invalid request.");
    return callJson({ saved: true });
  } catch (error) {
    if (error instanceof CallRequestError) return callJson({ error: error.message }, error.status);
    return callJson({ error: "The request could not be updated. Please try again." }, 503);
  }
}
