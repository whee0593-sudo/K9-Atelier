import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { MERCHANT_NOTIFY_EMAIL, readMerchantFromAddress } from "@/lib/communications/merchant-config";
import { isCommunicationAccepted } from "@/lib/communications/result";

export async function sendCallRequestNotice(id: string) {
  if (process.env.CALL_REQUEST_NOTICES_ENABLED !== "true") return;
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("call_requests").select("id,name,phone,status,notice_sent_at").eq("id", id).single();
  if (error || !row || row.status === "draft" || row.notice_sent_at) return;
  const sender = readMerchantFromAddress();
  if (!sender.ok) return;
  const result = await sendEmail({
    to: MERCHANT_NOTIFY_EMAIL, from: sender.from, subject: "New K9 Atelier callback request",
    text: `Name: ${row.name}\nPhone: ${row.phone}\n\nCard saved securely with Stripe. No charge today.\nThis is a callback request, not a confirmed appointment.\nReview it in Admin → Call Requests.`,
    communication: { notificationType: "merchant_call_request_received", audience: "staff", idempotencyKey: `call-request:${id}:received:email` },
  });
  if (isCommunicationAccepted(result)) {
    const { error: updateError } = await admin.from("call_requests").update({ notice_sent_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw new Error("call_notice_receipt_write_failed");
  }
}

export async function replayCallRequestNotices() {
  const { data, error } = await createAdminClient().from("call_requests").select("id").in("status", ["requested", "contacted"]).is("notice_sent_at", null).order("requested_at").limit(50);
  if (error) throw new Error("call_notice_queue_failed");
  for (const row of data ?? []) await sendCallRequestNotice(row.id);
  return { checked: data?.length ?? 0 };
}
