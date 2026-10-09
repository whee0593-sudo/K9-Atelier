import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

export type VisitNotificationClaim =
  | "claimed"
  | "sent"
  | "sending"
  | "unavailable"
  | "error";

export type VisitNotificationStore = {
  claim(visitId: string, event: string): Promise<VisitNotificationClaim>;
  complete(visitId: string, event: string): Promise<boolean>;
  release(visitId: string, event: string): Promise<void>;
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

export function memoryVisitNotificationStore(): VisitNotificationStore {
  const rows = new Map<string, { status: "sending" | "sent"; createdAt: string }>();
  const key = (visitId: string, event: string) => `${visitId}:${event}`;
  return {
    async claim(visitId, event) {
      const id = key(visitId, event);
      const current = rows.get(id);
      if (!current) {
        rows.set(id, { status: "sending", createdAt: new Date().toISOString() });
        return "claimed";
      }
      if (current.status === "sent") return "sent";
      if (isStaleVisitClaim(current.createdAt)) {
        rows.set(id, { status: "sending", createdAt: new Date().toISOString() });
        return "claimed";
      }
      return "sending";
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
  };
}

export function supabaseVisitNotificationStore(): VisitNotificationStore | null {
  if (!hasSupabaseAdminConfig()) return null;
  const admin = createAdminClient();

  async function readClaim(visitId: string, event: string) {
    const { data, error } = await admin
      .from("visit_notifications")
      .select("status, created_at")
      .eq("visit_id", visitId)
      .eq("event", event)
      .maybeSingle();
    if (error) return { error };
    return { row: data as { status: string; created_at: string } | null };
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
      if (row.status === "sent") return "sent";
      if (!isStaleVisitClaim(row.created_at)) return "sending";

      const released = await admin
        .from("visit_notifications")
        .delete()
        .eq("visit_id", visitId)
        .eq("event", event)
        .eq("status", "sending");
      if (released.error) return "sending";
      const retried = await admin.from("visit_notifications").insert({
        visit_id: visitId,
        event,
        status: "sending",
      });
      if (!retried.error) return "claimed";
      if (retried.error.code === "23505") return "sending";
      return "error";
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
  };
}

export type VisitNotificationResult = "sent" | "skipped" | "failed";

/**
 * One successful customer send per visit event.
 * A failed send releases the claim so the next attempt can try again.
 * Missing visit id or storage sends once for this call and cannot dedupe.
 */
export async function runVisitNotification(input: {
  visitId: string | null | undefined;
  event: string;
  send: () => Promise<boolean>;
  store?: VisitNotificationStore | null;
}): Promise<VisitNotificationResult> {
  const store =
    input.store === undefined ? supabaseVisitNotificationStore() : input.store;
  if (!input.visitId || !store) {
    try {
      return (await input.send()) ? "sent" : "failed";
    } catch (error) {
      console.error("visit notification send failed:", input.event, error);
      return "failed";
    }
  }

  const claim = await store.claim(input.visitId, input.event);
  if (claim === "sent" || claim === "sending") return "skipped";
  if (claim === "unavailable" || claim === "error") return "failed";

  try {
    const delivered = await input.send();
    if (!delivered) {
      await store.release(input.visitId, input.event);
      return "failed";
    }
    await store.complete(input.visitId, input.event);
    return "sent";
  } catch (error) {
    console.error("visit notification send failed:", input.event, error);
    await store.release(input.visitId, input.event);
    return "failed";
  }
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
