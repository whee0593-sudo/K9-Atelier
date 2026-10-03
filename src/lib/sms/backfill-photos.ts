import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { getStaffSession } from "@/lib/staff/auth";
import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import { inboundReplyTextForStaff } from "@/lib/sms/inbox-copy";
import { isStaffPhone } from "@/lib/sms/inbox";
import { phonesMatch } from "@/lib/sms/phone";
import { listTwilioInboundMms } from "@/lib/sms/twilio-history";

const MATCH_WINDOW_MS = 10 * 60 * 1000;

export type BackfillPhotosResult = {
  imported: number;
  updated: number;
  skipped: number;
  scanned: number;
};

function looksLikePhotoPlaceholder(body: string) {
  const text = body.trim().toLowerCase();
  return (
    text === "photo" ||
    /^\d+ photos$/.test(text) ||
    text.includes("[photo attached]") ||
    text.includes("[photos attached]") ||
    text.endsWith("photos attached]")
  );
}

function arraysOverlap(left: string[], right: string[]) {
  const set = new Set(left);
  return right.some((url) => set.has(url));
}

export function pickMatchingInboxRow(input: {
  rows: Array<{
    id: string;
    phone: string;
    body: string;
    media_urls: string[] | null;
    created_at: string;
  }>;
  from: string;
  dateSent: string;
  mediaUrls: string[];
}) {
  const sentAt = new Date(input.dateSent).getTime();
  if (Number.isNaN(sentAt)) return null;

  let best: { id: string; delta: number } | null = null;
  for (const row of input.rows) {
    const existing = Array.isArray(row.media_urls) ? row.media_urls : [];
    if (existing.length > 0) {
      if (arraysOverlap(existing, input.mediaUrls)) {
        return { id: row.id, alreadyHasMedia: true as const };
      }
      continue;
    }
    if (!phonesMatch(row.phone, input.from)) continue;
    if (!looksLikePhotoPlaceholder(row.body) && row.body.trim()) {
      // Allow text+photo rows that still lack media_urls.
      const lower = row.body.toLowerCase();
      if (!lower.includes("photo")) continue;
    }
    const createdAt = new Date(row.created_at).getTime();
    if (Number.isNaN(createdAt)) continue;
    const delta = Math.abs(createdAt - sentAt);
    if (delta > MATCH_WINDOW_MS) continue;
    if (!best || delta < best.delta) {
      best = { id: row.id, delta };
    }
  }
  return best ? { id: best.id, alreadyHasMedia: false as const } : null;
}

export async function backfillStaffSmsPhotos(): Promise<
  | BackfillPhotosResult
  | {
      error: "unauthenticated" | "forbidden" | "misconfigured" | "server";
      message?: string;
    }
> {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!hasSupabaseAdminConfig()) {
    return { error: "misconfigured", message: "Database is not configured." };
  }

  const history = await listTwilioInboundMms({ pageLimit: 6, pageSize: 50 });
  if ("error" in history) {
    return {
      error: history.error,
      message:
        history.error === "misconfigured"
          ? "Texting is not configured yet. Add Twilio keys in Vercel."
          : "Could not load message history from Twilio.",
    };
  }

  const admin = createAdminClient();
  const { data: existingRows, error: loadError } = await admin
    .from("customer_sms_messages")
    .select("id, phone, body, media_urls, created_at")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(400);

  if (loadError) {
    console.error("backfillStaffSmsPhotos load failed:", loadError.message);
    return { error: "server" };
  }

  const rows = (existingRows ?? []) as Array<{
    id: string;
    phone: string;
    body: string;
    media_urls: string[] | null;
    created_at: string;
  }>;

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const message of history) {
    if (isStaffPhone(message.from)) {
      skipped += 1;
      continue;
    }

    const already = rows.some((row) =>
      arraysOverlap(
        Array.isArray(row.media_urls) ? row.media_urls : [],
        message.mediaUrls,
      ),
    );
    if (already) {
      skipped += 1;
      continue;
    }

    const match = pickMatchingInboxRow({
      rows,
      from: message.from,
      dateSent: message.dateSent,
      mediaUrls: message.mediaUrls,
    });

    if (match?.alreadyHasMedia) {
      skipped += 1;
      continue;
    }

    const body = inboundReplyTextForStaff({
      body: message.body,
      mediaCount: message.mediaUrls.length,
    });

    if (match) {
      const { error: updateError } = await admin
        .from("customer_sms_messages")
        .update({
          media_urls: message.mediaUrls,
          body,
        })
        .eq("id", match.id);
      if (updateError) {
        console.error("backfillStaffSmsPhotos update failed:", updateError.message);
        return { error: "server" };
      }
      const row = rows.find((item) => item.id === match.id);
      if (row) row.media_urls = message.mediaUrls;
      updated += 1;
      continue;
    }

    const customer = await lookupCustomerByPhone(message.from);
    const { data: inserted, error: insertError } = await admin
      .from("customer_sms_messages")
      .insert({
        direction: "inbound",
        phone: message.from,
        body,
        customer_id: customer?.customerId ?? null,
        customer_name: customer?.name ?? "Unknown",
        pet_names: customer?.petNames.join(", ") || null,
        media_urls: message.mediaUrls,
        created_at: new Date(message.dateSent).toISOString(),
      })
      .select("id, phone, body, media_urls, created_at")
      .maybeSingle();

    if (insertError) {
      console.error("backfillStaffSmsPhotos insert failed:", insertError.message);
      return { error: "server" };
    }
    if (inserted) {
      rows.unshift({
        id: inserted.id as string,
        phone: inserted.phone as string,
        body: inserted.body as string,
        media_urls: (inserted.media_urls as string[] | null) ?? message.mediaUrls,
        created_at: inserted.created_at as string,
      });
    }
    imported += 1;
  }

  return {
    imported,
    updated,
    skipped,
    scanned: history.length,
  };
}
