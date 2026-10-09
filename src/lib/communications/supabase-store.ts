import { randomUUID } from "node:crypto";
import { decideClaim } from "@/lib/communications/claim";
import type { ClaimResult, CommunicationLogStore } from "@/lib/communications/store";
import type {
  CommunicationSnapshot,
  StoredCommunicationLog,
} from "@/lib/communications/types";
import { createAdminClient } from "@/lib/supabase/admin";

type LogRow = {
  id: string;
  channel: CommunicationSnapshot["channel"];
  provider: CommunicationSnapshot["provider"];
  notification_type: string;
  audience: CommunicationSnapshot["audience"];
  customer_id: string | null;
  visit_id: string | null;
  appointment_ids: string[] | null;
  pet_ids: string[] | null;
  recipient: string;
  subject: string | null;
  body_text: string;
  body_html: string | null;
  reply_to: string | null;
  status: StoredCommunicationLog["status"];
  skip_reason: StoredCommunicationLog["skipReason"];
  provider_message_id: string | null;
  error_message: string | null;
  idempotency_key: string;
  claim_token: string;
  claimed_at: string;
};

function snapshotFromRow(row: LogRow): CommunicationSnapshot {
  return {
    channel: row.channel,
    provider: row.provider,
    notificationType: row.notification_type,
    audience: row.audience,
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
}

function fromRow(row: LogRow): StoredCommunicationLog {
  return {
    id: row.id,
    snapshot: snapshotFromRow(row),
    status: row.status,
    skipReason: row.skip_reason,
    providerMessageId: row.provider_message_id,
    claimToken: row.claim_token,
    claimedAt: row.claimed_at,
    errorMessage: row.error_message,
  };
}

const LOG_COLUMNS =
  "id, channel, provider, notification_type, audience, customer_id, visit_id, appointment_ids, pet_ids, recipient, subject, body_text, body_html, reply_to, status, skip_reason, provider_message_id, error_message, idempotency_key, claim_token, claimed_at";

function insertPayload(
  snapshot: CommunicationSnapshot,
  input: {
    status: "pending" | "skipped";
    skipReason: StoredCommunicationLog["skipReason"];
    errorMessage: string | null;
    now: Date;
    claimToken: string;
  },
) {
  return {
    channel: snapshot.channel,
    provider: snapshot.provider,
    notification_type: snapshot.notificationType,
    audience: snapshot.audience,
    customer_id: snapshot.customerId,
    visit_id: snapshot.visitId,
    appointment_ids: snapshot.appointmentIds,
    pet_ids: snapshot.petIds,
    recipient: snapshot.recipient,
    subject: snapshot.subject,
    body_text: snapshot.bodyText,
    body_html: snapshot.bodyHtml,
    reply_to: snapshot.replyTo,
    status: input.status,
    skip_reason: input.skipReason,
    error_message: input.errorMessage,
    idempotency_key: snapshot.idempotencyKey,
    claim_token: input.claimToken,
    claimed_at: input.now.toISOString(),
  };
}

async function loadByKey(key: string): Promise<
  | { row: LogRow | null }
  | { error: string }
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("communication_logs")
    .select(LOG_COLUMNS)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) return { error: error.message };
  return { row: (data as LogRow | null) ?? null };
}

function duplicate(log: StoredCommunicationLog): ClaimResult {
  return {
    action: "duplicate_accepted",
    logId: log.id,
    providerMessageId: log.providerMessageId,
  };
}

export function createSupabaseCommunicationLogStore(): CommunicationLogStore {
  return {
    async claim(input) {
      const claimToken = randomUUID();
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("communication_logs")
        .insert(insertPayload(input.snapshot, { ...input, claimToken }))
        .select(LOG_COLUMNS)
        .single();

      if (!error && data) {
        const stored = fromRow(data as LogRow);
        if (input.status === "skipped") {
          return {
            action: "terminal_skip",
            logId: stored.id,
            skipReason: input.skipReason,
          };
        }
        return {
          action: "send",
          logId: stored.id,
          claimToken: stored.claimToken,
          snapshot: stored.snapshot,
        };
      }

      if (error && error.code !== "23505") {
        return { action: "log_failed", error: error.message };
      }

      const loaded = await loadByKey(input.snapshot.idempotencyKey);
      if ("error" in loaded) return { action: "log_failed", error: loaded.error };
      if (!loaded.row) {
        return { action: "log_failed", error: "idempotency row missing after conflict" };
      }
      const existing = fromRow(loaded.row);
      const decision = decideClaim(existing, input.now.getTime());
      if (decision.type === "duplicate_accepted") return duplicate(decision.log);
      if (decision.type === "in_flight") {
        return { action: "in_flight", logId: decision.log.id };
      }
      if (decision.type === "terminal_skip") {
        return {
          action: "terminal_skip",
          logId: decision.log.id,
          skipReason: decision.log.skipReason,
        };
      }
      if (decision.type === "send_existing" && input.status === "skipped") {
        return {
          action: "terminal_skip",
          logId: decision.log.id,
          skipReason: input.skipReason ?? decision.log.skipReason,
        };
      }
      if (decision.type === "insert") {
        return { action: "log_failed", error: "claim conflict did not resolve" };
      }

      const nextToken = randomUUID();
      const { data: claimed, error: claimError } = await admin
        .from("communication_logs")
        .update({
          status: "pending",
          skip_reason: null,
          error_message: null,
          failed_at: null,
          claim_token: nextToken,
          claimed_at: input.now.toISOString(),
        })
        .eq("id", decision.log.id)
        .eq("claim_token", decision.log.claimToken)
        .is("provider_message_id", null)
        .select(LOG_COLUMNS);

      if (claimError) return { action: "log_failed", error: claimError.message };
      const won = (claimed as LogRow[] | null)?.[0];
      if (!won) return { action: "in_flight", logId: decision.log.id };
      const stored = fromRow(won);
      return {
        action: "send",
        logId: stored.id,
        claimToken: stored.claimToken,
        snapshot: stored.snapshot,
      };
    },

    async markAccepted(input) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("communication_logs")
        .update({
          status: "accepted",
          provider_message_id: input.providerMessageId,
          error_message: null,
          skip_reason: null,
          accepted_at: input.now.toISOString(),
          failed_at: null,
        })
        .eq("id", input.logId)
        .eq("claim_token", input.claimToken)
        .select("id");
      if (error) return { ok: false, error: error.message };
      if (!data?.length) return { ok: false, error: "claim lost" };
      return { ok: true };
    },

    async markFailed(input) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("communication_logs")
        .update({
          status: "failed",
          error_message: input.errorMessage,
          failed_at: input.now.toISOString(),
        })
        .eq("id", input.logId)
        .eq("claim_token", input.claimToken)
        .select("id");
      if (error) return { ok: false, error: error.message };
      if (!data?.length) return { ok: false, error: "claim lost" };
      return { ok: true };
    },

    async recordAlert(input) {
      const admin = createAdminClient();
      const { error } = await admin.from("communication_log_alerts").insert({
        code: input.code,
        message: input.message,
        log_id: input.logId,
        idempotency_key: input.idempotencyKey,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },

    async read(logId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("communication_logs")
        .select(LOG_COLUMNS)
        .eq("id", logId)
        .maybeSingle();
      if (error || !data) return null;
      return fromRow(data as LogRow);
    },
  };
}
