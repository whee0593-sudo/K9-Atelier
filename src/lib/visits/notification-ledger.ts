import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import {
  normalizeVisitSendResult,
  type ProviderDelivery,
} from "@/lib/visits/provider-delivery";

export type VisitNotificationClaim =
  | "claimed"
  | "sent"
  | "sending"
  | "uncertain"
  | "unavailable"
  | "error";

export type VisitNotificationStore = {
  claim(visitId: string, event: string): Promise<VisitNotificationClaim>;
  markAttempted(visitId: string, event: string): Promise<boolean>;
  complete(visitId: string, event: string): Promise<boolean>;
  release(visitId: string, event: string): Promise<void>;
  hold(visitId: string, event: string): Promise<void>;
};

const STALE_CLAIM_MS = 15 * 60 * 1000;

export function isStaleVisitClaim(
  createdAt: string | null | undefined,
  now = Date.now(),
  ttlMs = STALE_CLAIM_MS,
) {
  if (!createdAt) return false;
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return false;
  return now - time >= ttlMs;
}

/**
 * A row may be sent again only when this process died before contacting
 * the provider. After attempted_at is set, or the outcome is uncertain,
 * another worker must not send.
 */
export function decideExistingVisitClaim(
  row: {
    status: string;
    createdAt: string | null;
    attemptedAt?: string | null;
  },
  now = Date.now(),
): "sent" | "sending" | "uncertain" | "reclaim" {
  if (row.status === "sent") return "sent";
  if (row.status === "uncertain") return "uncertain";
  if (row.attemptedAt) return "sending";
  if (row.status === "sending" && isStaleVisitClaim(row.createdAt, now)) {
    return "reclaim";
  }
  return "sending";
}

type MemoryRow = {
  status: "sending" | "sent" | "uncertain";
  createdAt: string;
  attemptedAt: string | null;
};

export function memoryVisitNotificationStore(options?: {
  now?: () => number;
}): VisitNotificationStore {
  const rows = new Map<string, MemoryRow>();
  const now = () => options?.now?.() ?? Date.now();
  const key = (visitId: string, event: string) => `${visitId}:${event}`;
  const fresh = (): MemoryRow => ({
    status: "sending",
    createdAt: new Date(now()).toISOString(),
    attemptedAt: null,
  });
  return {
    async claim(visitId, event) {
      const id = key(visitId, event);
      const current = rows.get(id);
      if (!current) {
        rows.set(id, fresh());
        return "claimed";
      }
      const decision = decideExistingVisitClaim(
        {
          status: current.status,
          createdAt: current.createdAt,
          attemptedAt: current.attemptedAt,
        },
        now(),
      );
      if (decision === "reclaim") {
        rows.set(id, fresh());
        return "claimed";
      }
      return decision;
    },
    async markAttempted(visitId, event) {
      const current = rows.get(key(visitId, event));
      if (!current || current.status !== "sending" || current.attemptedAt) {
        return false;
      }
      current.attemptedAt = new Date(now()).toISOString();
      return true;
    },
    async complete(visitId, event) {
      const id = key(visitId, event);
      const current = rows.get(id);
      if (!current || current.status !== "sending") return false;
      rows.set(id, { ...current, status: "sent" });
      return true;
    },
    async release(visitId, event) {
      const id = key(visitId, event);
      const current = rows.get(id);
      if (current?.status === "sending") rows.delete(id);
    },
    async hold(visitId, event) {
      const id = key(visitId, event);
      const current = rows.get(id);
      if (current?.status === "sending") {
        rows.set(id, { ...current, status: "uncertain" });
      }
    },
  };
}

export function supabaseVisitNotificationStore(): VisitNotificationStore | null {
  if (!hasSupabaseAdminConfig()) return null;
  const admin = createAdminClient();

  async function readClaim(visitId: string, event: string) {
    const { data, error } = await admin
      .from("visit_notifications")
      .select("status, created_at, attempted_at")
      .eq("visit_id", visitId)
      .eq("event", event)
      .maybeSingle();
    if (error) return { error };
    return {
      row: data as {
        status: string;
        created_at: string;
        attempted_at: string | null;
      } | null,
    };
  }

  return {
    async claim(visitId, event) {
      const inserted = await admin.from("visit_notifications").insert({
        visit_id: visitId,
        event,
        status: "sending",
      });
      if (!inserted.error) return "claimed";
      if (inserted.error.code !== "23505") {
        console.error(
          "visit notification claim failed:",
          visitId,
          event,
          inserted.error.message,
        );
        return "error";
      }

      const existing = await readClaim(visitId, event);
      if ("error" in existing && existing.error) {
        console.error(
          "visit notification reread failed:",
          visitId,
          event,
          existing.error.message,
        );
        return "error";
      }
      const row = "row" in existing ? existing.row : null;
      if (!row) return "error";
      const decision = decideExistingVisitClaim({
        status: row.status,
        createdAt: row.created_at,
        attemptedAt: row.attempted_at,
      });
      if (decision !== "reclaim") return decision;

      const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
      const released = await admin
        .from("visit_notifications")
        .delete()
        .eq("visit_id", visitId)
        .eq("event", event)
        .eq("status", "sending")
        .is("attempted_at", null)
        .lt("created_at", staleBefore)
        .select("visit_id");
      if (released.error || !released.data?.length) return "sending";
      const retried = await admin.from("visit_notifications").insert({
        visit_id: visitId,
        event,
        status: "sending",
      });
      if (!retried.error) return "claimed";
      if (retried.error.code === "23505") return "sending";
      return "error";
    },
    async markAttempted(visitId, event) {
      const { data, error } = await admin
        .from("visit_notifications")
        .update({ attempted_at: new Date().toISOString() })
        .eq("visit_id", visitId)
        .eq("event", event)
        .eq("status", "sending")
        .is("attempted_at", null)
        .select("visit_id");
      if (error) {
        console.error(
          "visit notification attempt mark failed:",
          visitId,
          event,
          error.message,
        );
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    },
    async complete(visitId, event) {
      const { data, error } = await admin
        .from("visit_notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("visit_id", visitId)
        .eq("event", event)
        .eq("status", "sending")
        .select("visit_id");
      if (error) {
        console.error(
          "visit notification complete failed:",
          visitId,
          event,
          error.message,
        );
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    },
    async release(visitId, event) {
      const { error } = await admin
        .from("visit_notifications")
        .delete()
        .eq("visit_id", visitId)
        .eq("event", event)
        .eq("status", "sending");
      if (error) {
        console.error(
          "visit notification release failed:",
          visitId,
          event,
          error.message,
        );
      }
    },
    async hold(visitId, event) {
      const { error } = await admin
        .from("visit_notifications")
        .update({ status: "uncertain" })
        .eq("visit_id", visitId)
        .eq("event", event)
        .eq("status", "sending");
      if (error) {
        console.error(
          "visit notification hold failed:",
          visitId,
          event,
          error.message,
        );
      }
    },
  };
}

export type VisitNotificationResult = "sent" | "skipped" | "failed";

/**
 * One successful customer send per visit event.
 * A definite provider rejection releases the claim.
 * A timeout or any other uncertain acceptance stays claimed so it is not sent twice.
 * Missing visit id or storage sends once for this call and cannot dedupe.
 */
export async function runVisitNotification(input: {
  visitId: string | null | undefined;
  event: string;
  send: () => Promise<boolean | ProviderDelivery>;
  store?: VisitNotificationStore | null;
}): Promise<VisitNotificationResult> {
  const store =
    input.store === undefined ? supabaseVisitNotificationStore() : input.store;
  if (!input.visitId || !store) {
    try {
      return normalizeVisitSendResult(await input.send()) === "delivered"
        ? "sent"
        : "failed";
    } catch (error) {
      console.error("visit notification send failed:", input.event, error);
      return "failed";
    }
  }

  const claim = await store.claim(input.visitId, input.event);
  if (claim === "sent" || claim === "sending" || claim === "uncertain") {
    return "skipped";
  }
  if (claim !== "claimed") return "failed";

  const started = await store.markAttempted(input.visitId, input.event);
  if (!started) return "skipped";

  let outcome: ProviderDelivery;
  try {
    outcome = normalizeVisitSendResult(await input.send());
  } catch (error) {
    console.error("visit notification send failed:", input.event, error);
    outcome = "uncertain";
  }

  if (outcome === "delivered") {
    await store.complete(input.visitId, input.event);
    return "sent";
  }
  if (outcome === "uncertain") {
    await store.hold(input.visitId, input.event);
    return "failed";
  }
  await store.release(input.visitId, input.event);
  return "failed";
}

/** Records an event that already went out inside another visit message. */
export async function recordVisitNotificationSent(
  visitId: string | null | undefined,
  event: string,
  store?: VisitNotificationStore | null,
) {
  if (!visitId) return;
  const resolved =
    store === undefined ? supabaseVisitNotificationStore() : store;
  if (!resolved) return;
  const claim = await resolved.claim(visitId, event);
  if (claim === "claimed") await resolved.complete(visitId, event);
}
