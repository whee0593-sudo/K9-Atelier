import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import { normalizePhoneToE164, phonesMatch } from "@/lib/sms/phone";
import {
  answeredFromStatus,
  callBannerLabel,
  callerTitle,
  chooseInboxPreview,
  communicationBadgeCount,
  communicationMessageBody,
  formatActivityAge,
  formatCallDuration,
  formatDisplayPhone,
  formatEtTime,
  formatMissedCallWhen,
  isMissedCallStatus,
  isTerminalCallStatus,
  mergeCallStatus,
  statusFromCustomerLeg,
  statusFromParentCallback,
  threadCallLabel,
  UNKNOWN_CALLER_LABEL,
  type InboxRow,
} from "@/lib/communication/present";
import type { CommunicationDetail } from "@/lib/communication/types";

const MISSED_STATUSES = ["busy", "no-answer", "failed", "canceled"];

type Admin = ReturnType<typeof createAdminClient>;

type ConversationRef = {
  id: string;
  customerId: string | null;
  unreadCount: number;
  phoneNumber: string;
};

function db() {
  if (!hasSupabaseAdminConfig()) return null;
  return createAdminClient();
}

function cleanSid(value?: string | null) {
  const sid = value?.trim() ?? "";
  return sid || null;
}

function stamp(value?: string | null) {
  if (value && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return new Date().toISOString();
}

async function ensureConversation(
  admin: Admin,
  phone: string,
  at: string,
): Promise<ConversationRef | null> {
  const phoneNumber = normalizePhoneToE164(phone);
  if (!phoneNumber) return null;
  const customer = await lookupCustomerByPhone(phoneNumber);
  const { data: existing, error } = await admin
    .from("communication_conversations")
    .select("id, customer_id, unread_count, phone_number")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  if (error) {
    console.error("communication conversation lookup failed:", error.message);
    return null;
  }
  if (existing) {
    let customerId = (existing.customer_id as string | null) ?? null;
    if (customer && !customerId) {
      const { error: linkError } = await admin
        .from("communication_conversations")
        .update({ customer_id: customer.customerId })
        .eq("id", existing.id)
        .is("customer_id", null);
      if (!linkError) customerId = customer.customerId;
    }
    return {
      id: existing.id as string,
      customerId,
      unreadCount: Number(existing.unread_count ?? 0),
      phoneNumber,
    };
  }

  const { data: inserted, error: insertError } = await admin
    .from("communication_conversations")
    .insert({
      phone_number: phoneNumber,
      customer_id: customer?.customerId ?? null,
      last_activity_at: at,
      unread_count: 0,
    })
    .select("id, customer_id, unread_count, phone_number")
    .single();
  if (insertError?.code === "23505") {
    const { data: raced } = await admin
      .from("communication_conversations")
      .select("id, customer_id, unread_count, phone_number")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (!raced) return null;
    return {
      id: raced.id as string,
      customerId: (raced.customer_id as string | null) ?? null,
      unreadCount: Number(raced.unread_count ?? 0),
      phoneNumber,
    };
  }
  if (insertError || !inserted) {
    console.error("communication conversation insert failed:", insertError?.message);
    return null;
  }
  return {
    id: inserted.id as string,
    customerId: (inserted.customer_id as string | null) ?? null,
    unreadCount: Number(inserted.unread_count ?? 0),
    phoneNumber,
  };
}

async function touchConversation(
  admin: Admin,
  id: string,
  at: string,
  unreadCount?: number,
) {
  const patch: { last_activity_at: string; unread_count?: number } = {
    last_activity_at: at,
  };
  if (unreadCount != null) patch.unread_count = unreadCount;
  const { error } = await admin
    .from("communication_conversations")
    .update(patch)
    .eq("id", id);
  if (error) console.error("communication conversation update failed:", error.message);
}

async function findCall(admin: Admin, callSid: string) {
  const { data, error } = await admin
    .from("communication_calls")
    .select("id, conversation_id, direction, status, answered, read_at, ended_at")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (error) {
    console.error("communication call lookup failed:", error.message);
    return null;
  }
  return data;
}

export async function recordInboundMessage(input: {
  messageSid?: string | null;
  from: string;
  to: string;
  body: string;
  mediaCount?: number;
  status?: string | null;
  createdAt?: string | null;
}) {
  const admin = db();
  if (!admin) return;
  const body = communicationMessageBody(input.body, input.mediaCount ?? 0);
  if (!body) return;
  const at = stamp(input.createdAt);
  const conversation = await ensureConversation(admin, input.from, at);
  if (!conversation) return;
  const sid = cleanSid(input.messageSid);
  if (sid) {
    const { data: existing } = await admin
      .from("communication_messages")
      .select("id")
      .eq("twilio_message_sid", sid)
      .maybeSingle();
    if (existing) {
      await admin
        .from("communication_messages")
        .update({ status: input.status?.trim() || "received" })
        .eq("id", existing.id);
      return;
    }
  }
  const { error } = await admin.from("communication_messages").insert({
    conversation_id: conversation.id,
    twilio_message_sid: sid,
    direction: "inbound",
    from_number: normalizePhoneToE164(input.from) ?? input.from,
    to_number: normalizePhoneToE164(input.to) ?? input.to,
    body,
    status: input.status?.trim() || "received",
    created_at: at,
  });
  if (error) {
    if (error.code !== "23505") {
      console.error("recordInboundMessage failed:", error.message);
    }
    return;
  }
  await touchConversation(admin, conversation.id, at, conversation.unreadCount + 1);
}

export async function recordOutboundMessage(input: {
  messageSid?: string | null;
  from: string;
  to: string;
  body: string;
  status?: string | null;
}) {
  const admin = db();
  if (!admin) return;
  const body = communicationMessageBody(input.body);
  if (!body) return;
  const at = new Date().toISOString();
  const conversation = await ensureConversation(admin, input.to, at);
  if (!conversation) return;
  const sid = cleanSid(input.messageSid);
  if (sid) {
    const { data: existing } = await admin
      .from("communication_messages")
      .select("id")
      .eq("twilio_message_sid", sid)
      .maybeSingle();
    if (existing) {
      await admin
        .from("communication_messages")
        .update({ status: input.status?.trim() || "sent" })
        .eq("id", existing.id);
      return;
    }
  }
  const { error } = await admin.from("communication_messages").insert({
    conversation_id: conversation.id,
    twilio_message_sid: sid,
    direction: "outbound",
    from_number: normalizePhoneToE164(input.from) ?? input.from,
    to_number: conversation.phoneNumber,
    body,
    status: input.status?.trim() || "sent",
    created_at: at,
    read_at: at,
  });
  if (error) {
    if (error.code !== "23505") {
      console.error("recordOutboundMessage failed:", error.message);
    }
    return;
  }
  await touchConversation(admin, conversation.id, at);
}

export async function updateMessageStatus(messageSid: string, status: string) {
  const admin = db();
  const sid = cleanSid(messageSid);
  const next = status.trim();
  if (!admin || !sid || !next) return;
  const { error } = await admin
    .from("communication_messages")
    .update({ status: next })
    .eq("twilio_message_sid", sid);
  if (error) console.error("updateMessageStatus failed:", error.message);
}

export async function recordInboundCall(input: {
  callSid: string;
  from: string;
  to: string;
  status?: string | null;
}) {
  const admin = db();
  const sid = cleanSid(input.callSid);
  if (!admin || !sid) return;
  const at = new Date().toISOString();
  const conversation = await ensureConversation(admin, input.from, at);
  if (!conversation) return;
  const { error } = await admin.from("communication_calls").insert({
    conversation_id: conversation.id,
    twilio_call_sid: sid,
    direction: "inbound",
    from_number: conversation.phoneNumber,
    to_number: normalizePhoneToE164(input.to) ?? input.to,
    status: input.status?.trim() || "ringing",
    answered: null,
    started_at: at,
  });
  if (error) {
    if (error.code !== "23505") {
      console.error("recordInboundCall failed:", error.message);
    }
    return;
  }
  await touchConversation(admin, conversation.id, at);
}

export async function applyDialOutcome(input: {
  callSid: string;
  from: string;
  to: string;
  dialStatus: string;
  durationSeconds?: number | null;
}) {
  const admin = db();
  const sid = cleanSid(input.callSid);
  const dialStatus = input.dialStatus.trim().toLowerCase();
  if (!admin || !sid || !dialStatus) return;
  const missed = isMissedCallStatus(dialStatus);
  const answered = dialStatus === "completed" || dialStatus === "answered";
  if (!missed && !answered) return;

  let call = await findCall(admin, sid);
  if (!call) {
    await recordInboundCall({
      callSid: sid,
      from: input.from,
      to: input.to,
      status: "ringing",
    });
    call = await findCall(admin, sid);
  }
  if (!call) return;

  const at = new Date().toISOString();
  const patch: {
    status: string;
    answered: boolean;
    ended_at: string;
    duration?: number;
    read_at?: string;
  } = {
    status: missed ? dialStatus : "completed",
    answered: !missed,
    ended_at: at,
  };
  if (input.durationSeconds != null) patch.duration = input.durationSeconds;
  if (!missed) patch.read_at = (call.read_at as string | null) ?? at;
  const { error } = await admin.from("communication_calls").update(patch).eq("id", call.id);
  if (error) {
    console.error("applyDialOutcome failed:", error.message);
    return;
  }
  await touchConversation(admin, call.conversation_id as string, at);
}

export async function recordOutboundCall(input: {
  callSid: string;
  from: string;
  to: string;
}) {
  const admin = db();
  const sid = cleanSid(input.callSid);
  if (!admin || !sid) return;
  const at = new Date().toISOString();
  const conversation = await ensureConversation(admin, input.to, at);
  if (!conversation) return;
  const { error } = await admin.from("communication_calls").insert({
    conversation_id: conversation.id,
    twilio_call_sid: sid,
    direction: "outbound",
    from_number: normalizePhoneToE164(input.from) ?? input.from,
    to_number: conversation.phoneNumber,
    status: "initiated",
    answered: null,
    started_at: at,
  });
  if (error) {
    if (error.code !== "23505") {
      console.error("recordOutboundCall failed:", error.message);
    }
    return;
  }
  await touchConversation(admin, conversation.id, at);
}

export async function applyVoiceStatus(input: {
  callSid: string;
  parentCallSid?: string | null;
  leg: "parent" | "customer";
  callStatus: string;
  durationSeconds?: number | null;
}) {
  const admin = db();
  if (!admin) return;
  const sid = cleanSid(
    input.leg === "customer" ? input.parentCallSid || input.callSid : input.callSid,
  );
  if (!sid) return;
  const call = await findCall(admin, sid);
  if (!call || call.direction === "inbound") return;

  const mapped =
    input.leg === "customer"
      ? statusFromCustomerLeg(input.callStatus)
      : input.callStatus.trim().toLowerCase() === "connecting"
        ? "connecting"
        : statusFromParentCallback(input.callStatus);
  const status = mergeCallStatus(String(call.status ?? ""), mapped);
  const answered = answeredFromStatus(status, (call.answered as boolean | null) ?? null);
  const at = new Date().toISOString();
  const patch: {
    status: string;
    answered: boolean | null;
    ended_at?: string;
    duration?: number;
  } = { status, answered };
  if (isTerminalCallStatus(status)) {
    patch.ended_at = (call.ended_at as string | null) ?? at;
  }
  if (input.durationSeconds != null && input.leg === "parent") {
    patch.duration = input.durationSeconds;
  }
  const { error } = await admin.from("communication_calls").update(patch).eq("id", call.id);
  if (error) console.error("applyVoiceStatus failed:", error.message);
}

export async function markCallConnecting(callSid: string) {
  await applyVoiceStatus({
    callSid,
    leg: "parent",
    callStatus: "connecting",
  });
}

export async function associateCommunicationByPhone(customerId: string, phone: string) {
  const admin = db();
  const phoneNumber = normalizePhoneToE164(phone);
  if (!admin || !phoneNumber || !customerId) return;
  const { error } = await admin
    .from("communication_conversations")
    .update({ customer_id: customerId })
    .eq("phone_number", phoneNumber)
    .is("customer_id", null);
  if (error) console.error("associateCommunicationByPhone failed:", error.message);
}

export async function markConversationRead(conversationId: string) {
  const admin = db();
  if (!admin) return;
  const at = new Date().toISOString();
  const messages = await admin
    .from("communication_messages")
    .update({ read_at: at })
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .is("read_at", null);
  if (messages.error) {
    console.error("mark message read failed:", messages.error.message);
  }
  const calls = await admin
    .from("communication_calls")
    .update({ read_at: at })
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .eq("answered", false)
    .is("read_at", null);
  if (calls.error) console.error("mark call read failed:", calls.error.message);
  const conversation = await admin
    .from("communication_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
  if (conversation.error) {
    console.error("clear unread failed:", conversation.error.message);
  }
}

export async function getCommunicationBadgeCount() {
  const admin = db();
  if (!admin) return 0;
  const unread = await admin
    .from("communication_conversations")
    .select("id", { count: "exact", head: true })
    .gt("unread_count", 0);
  const missed = await admin
    .from("communication_calls")
    .select("id", { count: "exact", head: true })
    .eq("direction", "inbound")
    .eq("answered", false)
    .is("read_at", null)
    .in("status", MISSED_STATUSES);
  if (unread.error || missed.error) {
    console.error(
      "communication badge failed:",
      unread.error?.message ?? missed.error?.message,
    );
    return 0;
  }
  return communicationBadgeCount({
    unreadConversations: unread.count ?? 0,
    unhandledMissedCalls: missed.count ?? 0,
  });
}

type CustomerCard = {
  firstName: string;
  name: string;
  petNames: string[];
};

async function loadCustomerCards(admin: Admin, ids: string[]) {
  const cards = new Map<string, CustomerCard>();
  if (ids.length === 0) return cards;
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids);
  if (error) {
    console.error("communication profile lookup failed:", error.message);
    return cards;
  }
  const { data: pets, error: petsError } = await admin
    .from("pets")
    .select("customer_id, name, created_at")
    .in("customer_id", ids)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (petsError) console.error("communication pet lookup failed:", petsError.message);
  const petNames = new Map<string, string[]>();
  for (const pet of pets ?? []) {
    const name = String(pet.name ?? "").trim();
    if (!name) continue;
    const customerId = pet.customer_id as string;
    const list = petNames.get(customerId) ?? [];
    list.push(name);
    petNames.set(customerId, list);
  }
  for (const profile of profiles ?? []) {
    const first = String(profile.first_name ?? "").trim();
    const last = String(profile.last_name ?? "").trim();
    const name = [first, last].filter(Boolean).join(" ") || String(profile.email ?? "");
    cards.set(profile.id as string, {
      firstName: first,
      name,
      petNames: petNames.get(profile.id as string) ?? [],
    });
  }
  return cards;
}

async function linkUnmatched(
  admin: Admin,
  rows: Array<{ id: string; phone_number: string; customer_id: string | null }>,
) {
  const unmatched = rows.filter((row) => !row.customer_id);
  if (unmatched.length === 0) return;
  const { data: profiles, error } = await admin.from("profiles").select("id, phone");
  if (error || !profiles) return;
  for (const row of unmatched) {
    const profile = profiles.find((item) => phonesMatch(item.phone as string | null, row.phone_number));
    if (!profile) continue;
    const { error: updateError } = await admin
      .from("communication_conversations")
      .update({ customer_id: profile.id })
      .eq("id", row.id)
      .is("customer_id", null);
    if (!updateError) row.customer_id = profile.id as string;
  }
}

function displayTitle(customerId: string | null, card: CustomerCard | null) {
  if (!customerId) return UNKNOWN_CALLER_LABEL;
  const title = callerTitle({ firstName: card?.firstName, name: card?.name });
  return title === UNKNOWN_CALLER_LABEL ? "Customer" : title;
}

type InboxRecord = {
  id: string;
  phone_number: string;
  customer_id: string | null;
  last_activity_at: string;
  unread_count: number | null;
  latest_message_body: string | null;
  latest_message_direction: string | null;
  latest_message_at: string | null;
  latest_call_status: string | null;
  latest_call_direction: string | null;
  latest_call_answered: boolean | null;
  latest_call_started_at: string | null;
  latest_call_at: string | null;
  has_message: boolean | null;
  has_call: boolean | null;
  missed_unhandled: boolean | null;
};

function mapInboxRow(record: InboxRecord, card: CustomerCard | null, now: number): InboxRow {
  const message = record.latest_message_at
    ? {
        at: record.latest_message_at,
        direction:
          record.latest_message_direction === "outbound"
            ? ("outbound" as const)
            : ("inbound" as const),
        body: record.latest_message_body ?? "",
      }
    : null;
  const call = record.latest_call_at
    ? {
        at: record.latest_call_started_at || record.latest_call_at,
        direction:
          record.latest_call_direction === "outbound"
            ? ("outbound" as const)
            : ("inbound" as const),
        status: record.latest_call_status ?? "",
        answered: record.latest_call_answered,
      }
    : null;
  const chosen = chooseInboxPreview({
    message,
    call,
    missedUnhandled: Boolean(record.missed_unhandled),
  });
  const at = chosen.at || record.last_activity_at;
  return {
    id: record.id,
    phoneDisplay: formatDisplayPhone(record.phone_number),
    title: displayTitle(record.customer_id, card),
    petNames: card?.petNames.join(", ") ?? "",
    preview: chosen.preview,
    timeLabel: formatActivityAge(at, now),
    activityAt: at,
    unread: Number(record.unread_count ?? 0) > 0,
    missed: Boolean(record.missed_unhandled),
    unknown: !record.customer_id,
    hasMessage: Boolean(record.has_message),
    hasCall: Boolean(record.has_call),
    customerId: record.customer_id,
  };
}

export async function listCommunicationInbox(): Promise<{
  rows: InboxRow[];
  unavailable: boolean;
}> {
  const admin = db();
  if (!admin) return { rows: [], unavailable: true };
  const { data, error } = await admin
    .from("communication_inbox_rows")
    .select("*")
    .order("last_activity_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("listCommunicationInbox failed:", error.message);
    return { rows: [], unavailable: true };
  }
  const records = (data ?? []) as InboxRecord[];
  await linkUnmatched(admin, records);
  const cards = await loadCustomerCards(
    admin,
    [...new Set(records.map((row) => row.customer_id).filter(Boolean))] as string[],
  );
  const now = Date.now();
  return {
    rows: records.map((record) =>
      mapInboxRow(record, record.customer_id ? cards.get(record.customer_id) ?? null : null, now),
    ),
    unavailable: false,
  };
}

export async function getConversationRecord(conversationId: string) {
  const admin = db();
  if (!admin) return null;
  const { data, error } = await admin
    .from("communication_conversations")
    .select("id, phone_number, customer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    console.error("getConversationRecord failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = {
    id: data.id as string,
    phone_number: data.phone_number as string,
    customer_id: (data.customer_id as string | null) ?? null,
  };
  await linkUnmatched(admin, [row]);
  return row;
}

export async function getCommunicationDetail(
  conversationId: string,
): Promise<CommunicationDetail | null> {
  const admin = db();
  if (!admin) return null;
  const conversation = await getConversationRecord(conversationId);
  if (!conversation) return null;
  const [messagesResult, callsResult, cards] = await Promise.all([
    admin
      .from("communication_messages")
      .select("id, direction, body, status, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    admin
      .from("communication_calls")
      .select("id, direction, status, answered, duration, started_at, ended_at, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    loadCustomerCards(
      admin,
      conversation.customer_id ? [conversation.customer_id] : [],
    ),
  ]);
  if (messagesResult.error) {
    console.error("communication messages failed:", messagesResult.error.message);
  }
  if (callsResult.error) {
    console.error("communication calls failed:", callsResult.error.message);
  }
  const card = conversation.customer_id
    ? cards.get(conversation.customer_id) ?? null
    : null;
  const messages = (messagesResult.data ?? []).map((row) => {
    const at = row.created_at as string;
    return {
      kind: "message" as const,
      id: row.id as string,
      at,
      direction: row.direction === "outbound" ? ("outbound" as const) : ("inbound" as const),
      body: String(row.body ?? ""),
      timeLabel: formatEtTime(new Date(at)),
      status: String(row.status ?? ""),
    };
  });
  const calls = (callsResult.data ?? []).map((row) => {
    const at = (row.started_at as string | null) || (row.created_at as string);
    const direction = row.direction === "outbound" ? ("outbound" as const) : ("inbound" as const);
    const status = String(row.status ?? "");
    const answered = (row.answered as boolean | null) ?? null;
    const missed =
      direction === "inbound" && (answered === false || isMissedCallStatus(status));
    return {
      kind: "call" as const,
      id: row.id as string,
      at,
      direction,
      label: threadCallLabel({ direction, status, answered }),
      whenLabel: missed ? formatMissedCallWhen(at) : formatMissedCallWhen(at),
      durationLabel: formatCallDuration(row.duration as number | null),
      missed,
      status,
      endedAt: (row.ended_at as string | null) ?? null,
    };
  });
  const timeline = [...messages, ...calls.map(({ endedAt: _ended, ...call }) => call)].sort(
    (left, right) => Date.parse(left.at) - Date.parse(right.at),
  );
  const latestOutbound = [...calls]
    .reverse()
    .find((call) => call.direction === "outbound");
  return {
    id: conversation.id,
    phoneE164: conversation.phone_number,
    phoneDisplay: formatDisplayPhone(conversation.phone_number),
    title: displayTitle(conversation.customer_id, card),
    petNames: card?.petNames.join(", ") ?? "",
    customerId: conversation.customer_id,
    unknown: !conversation.customer_id,
    timeline,
    banner: latestOutbound
      ? callBannerLabel({
          status: latestOutbound.status,
          endedAt: latestOutbound.endedAt,
        })
      : null,
  };
}
