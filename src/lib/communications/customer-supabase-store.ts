import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunicationClaimStore } from "@/lib/communications/customer-log-store";
import type {
  CommunicationAudience,
  CommunicationChannel,
  CommunicationLogStatus,
  CommunicationProvider,
  CommunicationSkipReason,
  CommunicationSnapshot,
  StoredCommunicationLog,
} from "@/lib/communications/types";

type LogRow = {
  id: string;
  channel: CommunicationChannel;
  provider: CommunicationProvider | null;
  notification_type: string;
  audience: CommunicationAudience;
  customer_id: string | null;
  visit_id: string | null;
  appointment_ids: string[] | null;
  pet_ids: string[] | null;
  recipient: string;
  subject: string | null;
  body_text: string;
  body_html: string | null;
  reply_to: string | null;
  status: CommunicationLogStatus;
  skip_reason: CommunicationSkipReason | null;
  provider_message_id: string | null;
  idempotency_key: string;
  claim_token: string;
  claimed_at: string;
  error_message: string | null;
};

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export function mapCommunicationLogRow(row: LogRow): StoredCommunicationLog {
  const snapshot: CommunicationSnapshot = {
    channel: row.channel,
    provider: row.provider === "twilio" ? "twilio" : "resend",
    notificationType: row.notification_type,
    audience: row.audience === "staff" ? "staff" : "customer",
    customerId: row.customer_id,
    visitId: row.visit_id,
    appointmentIds: row.appointment_ids ?? [],
    petIds: row.pet_ids ?? [],
    recipient: row.recipient,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    replyTo: row.reply_to,
    idempotencyKey: row.idempotency_key,
  };
  return {
    id: row.id,
    snapshot,
    status: row.status,
    skipReason: row.skip_reason,
    providerMessageId: row.provider_message_id,
    claimToken: row.claim_token,
    claimedAt: row.claimed_at,
    errorMessage: row.error_message,
  };
}

const LOG_COLUMNS =
  "id, channel, provider, notification_type, audience, customer_id, visit_id, appointment_ids, pet_ids, recipient, subject, body_text, body_html, reply_to, status, skip_reason, provider_message_id, idempotency_key, claim_token, claimed_at, error_message";

/**
 * Application claim store. Uses decideClaim in deliverTrackedNotice.
 * Does not call communication_logs_claim and does not apply a second rule
 * based on provider_called_at.
 */
export function createSupabaseClaimStore(
  admin: SupabaseClient,
): CommunicationClaimStore {
  const logs = () => admin.from("communication_logs");

  async function readRow(idempotencyKey: string) {
    const { data, error } = await logs()
      .select(LOG_COLUMNS)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as LogRow | null) ?? null;
  }

  return {
    async read(idempotencyKey) {
      const row = await readRow(idempotencyKey);
      return row ? mapCommunicationLogRow(row) : null;
    },
    async insert(log) {
      const { error } = await logs().insert({
        id: log.id,
        channel: log.snapshot.channel,
        provider: log.snapshot.provider,
        notification_type: log.snapshot.notificationType,
        audience: log.snapshot.audience,
        customer_id: log.snapshot.customerId,
        visit_id: log.snapshot.visitId,
        appointment_ids: log.snapshot.appointmentIds,
        pet_ids: log.snapshot.petIds,
        recipient: log.snapshot.recipient,
        subject: log.snapshot.subject,
        body_text: log.snapshot.bodyText,
        body_html: log.snapshot.bodyHtml,
        reply_to: log.snapshot.replyTo,
        status: log.status,
        skip_reason: log.skipReason,
        idempotency_key: log.snapshot.idempotencyKey,
        claim_token: log.claimToken,
        claimed_at: log.claimedAt,
      });
      if (!error) return "inserted";
      if (isUniqueViolation(error)) return "conflict";
      throw new Error(error.message);
    },
    async reopen(id, expectedClaimToken, next) {
      const { data, error } = await logs()
        .update({
          status: "pending",
          skip_reason: null,
          provider_message_id: null,
          error_message: null,
          claim_token: next.claimToken,
          claimed_at: next.claimedAt,
        })
        .eq("id", id)
        .eq("claim_token", expectedClaimToken)
        .select(LOG_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapCommunicationLogRow(data as LogRow) : null;
    },
    async finish(id, expectedClaimToken, patch) {
      const now = new Date().toISOString();
      const { data, error } = await logs()
        .update({
          status: patch.status,
          skip_reason: patch.skipReason,
          provider_message_id: patch.providerMessageId,
          error_message: patch.errorMessage,
          accepted_at: patch.status === "accepted" ? now : null,
          failed_at: patch.status === "failed" ? now : null,
        })
        .eq("id", id)
        .eq("claim_token", expectedClaimToken)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
    async listRetryable(notificationType) {
      const failed = await logs()
        .select(LOG_COLUMNS)
        .eq("notification_type", notificationType)
        .eq("status", "failed")
        .limit(25);
      if (failed.error) throw new Error(failed.error.message);
      const skipped = await logs()
        .select(LOG_COLUMNS)
        .eq("notification_type", notificationType)
        .eq("status", "skipped")
        .eq("skip_reason", "missing_config")
        .limit(25);
      if (skipped.error) throw new Error(skipped.error.message);
      return [...(failed.data ?? []), ...(skipped.data ?? [])].map((row) =>
        mapCommunicationLogRow(row as LogRow),
      );
    },
  };
}
