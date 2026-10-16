import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClaimResult,
  CommunicationLogStatus,
  CommunicationSnapshot,
  CommunicationStore,
} from "@/lib/communications/store";

type LogRow = {
  id: string;
  claim_token: string;
  status: CommunicationLogStatus;
  provider_called_at: string | null;
  provider_message_id: string | null;
  idempotency_key: string;
};

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

/**
 * Uses the production communication_logs columns, including provider_called_at.
 * Does not call communication_logs_claim. That RPC's return shape is not in
 * git, so calling it would be a second, unverified claim rule.
 * A row whose provider_called_at is set is never claimed for another send.
 */
export function createSupabaseCommunicationStore(
  admin: SupabaseClient,
): CommunicationStore {
  const logs = () => admin.from("communication_logs");
  const alerts = () => admin.from("communication_log_alerts");

  async function readByKey(key: string): Promise<LogRow | null> {
    const { data, error } = await logs()
      .select(
        "id, claim_token, status, provider_called_at, provider_message_id, idempotency_key",
      )
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as LogRow | null) ?? null;
  }

  async function decideExisting(
    row: LogRow,
    snapshot: CommunicationSnapshot,
  ): Promise<ClaimResult> {
    if (
      row.status === "accepted" ||
      row.status === "delivered" ||
      row.status === "undelivered" ||
      row.status === "bounced"
    ) {
      return { action: "duplicate" };
    }
    if (row.status === "uncertain" || row.provider_called_at) {
      return { action: "unresolved" };
    }
    if (snapshot.intendedStatus === "skipped") return { action: "recorded" };
    if (row.status === "skipped") return claimSkipped(row);
    if (row.status === "pending") return markCalled(row);
    return { action: "unresolved" };
  }

  async function markCalled(row: LogRow): Promise<ClaimResult> {
    const calledAt = new Date().toISOString();
    const { data, error } = await logs()
      .update({ provider_called_at: calledAt })
      .eq("id", row.id)
      .is("provider_called_at", null)
      .select("id, claim_token")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { action: "unresolved" };
    return {
      action: "send",
      id: data.id as string,
      claimToken: data.claim_token as string,
    };
  }

  async function claimSkipped(row: LogRow): Promise<ClaimResult> {
    const calledAt = new Date().toISOString();
    const { data, error } = await logs()
      .update({
        status: "pending",
        provider_called_at: calledAt,
        skip_reason: null,
      })
      .eq("id", row.id)
      .eq("status", "skipped")
      .is("provider_called_at", null)
      .select("id, claim_token")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { action: "unresolved" };
    return {
      action: "send",
      id: data.id as string,
      claimToken: data.claim_token as string,
    };
  }

  function insertPayload(snapshot: CommunicationSnapshot, claimToken: string) {
    return {
      channel: snapshot.channel,
      notification_type: snapshot.notificationType,
      audience: "staff",
      customer_id: snapshot.customerId,
      visit_id: snapshot.visitId,
      appointment_ids: snapshot.appointmentIds,
      pet_ids: snapshot.petIds,
      recipient: snapshot.recipient,
      subject: snapshot.subject,
      body_text: snapshot.bodyText,
      body_html: snapshot.bodyHtml,
      reply_to: snapshot.replyTo,
      status: snapshot.intendedStatus,
      skip_reason: snapshot.skipReason,
      provider: snapshot.provider,
      idempotency_key: snapshot.idempotencyKey,
      claim_token: claimToken,
    };
  }

  return {
    async claim(snapshot) {
      const existing = await readByKey(snapshot.idempotencyKey);
      if (existing) return decideExisting(existing, snapshot);

      const claimToken = randomUUID();
      const { data, error } = await logs()
        .insert(insertPayload(snapshot, claimToken))
        .select("id, claim_token")
        .single();
      if (error) {
        if (!isUniqueViolation(error)) throw new Error(error.message);
        const raced = await readByKey(snapshot.idempotencyKey);
        if (!raced) throw new Error(error.message);
        return decideExisting(raced, snapshot);
      }

      if (snapshot.intendedStatus === "skipped") return { action: "recorded" };
      return markCalled({
        id: data.id as string,
        claim_token: data.claim_token as string,
        status: "pending",
        provider_called_at: null,
        provider_message_id: null,
        idempotency_key: snapshot.idempotencyKey,
      });
    },

    async complete(input) {
      const now = new Date().toISOString();
      const { data, error } = await logs()
        .update({
          status: input.status,
          provider_message_id: input.providerMessageId,
          error_message: input.errorMessage,
          accepted_at: input.status === "accepted" ? now : null,
          failed_at: input.status === "failed" ? now : null,
        })
        .eq("id", input.id)
        .eq("claim_token", input.claimToken)
        .select("id")
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },

    async recordAlert(input) {
      const { error } = await alerts().insert({
        code: input.code,
        message: input.message,
        log_id: input.logId ?? null,
        idempotency_key: input.idempotencyKeyHash,
      });
      if (!error) return true;
      return isUniqueViolation(error);
    },

    async listAlerts(code, options) {
      let query = alerts()
        .select("id, message")
        .eq("code", code)
        .order("created_at", { ascending: true })
        .limit(25);
      const excludeIds = options?.excludeIds?.filter(Boolean) ?? [];
      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        message: row.message as string,
      }));
    },

    async deleteAlert(id) {
      const { error } = await alerts().delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
