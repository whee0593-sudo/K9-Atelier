import { getCommunicationDetail, getConversationRecord, listCommunicationInbox, markConversationRead } from "@/lib/communication/store";
import { buildStaffCustomerSms } from "@/lib/sms/staff-compose-copy";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { getStaffSession } from "@/lib/staff/auth";
import { startStaffOutboundCall } from "@/lib/voice/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isConversationId(value: string) {
  return UUID_PATTERN.test(value);
}

export async function listStaffCommunication() {
  const session = await getStaffSession();
  if ("error" in session) return session;
  const inbox = await listCommunicationInbox();
  return inbox;
}

export async function readStaffCommunication(conversationId: string) {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!isConversationId(conversationId)) return { error: "not_found" as const };
  const existing = await getCommunicationDetail(conversationId);
  if (!existing) return { error: "not_found" as const };
  await markConversationRead(conversationId);
  const detail = (await getCommunicationDetail(conversationId)) ?? existing;
  return { detail };
}

export async function sendStaffCommunicationMessage(
  conversationId: string,
  body: string,
) {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!isConversationId(conversationId)) return { error: "not_found" as const };
  const conversation = await getConversationRecord(conversationId);
  if (!conversation) return { error: "not_found" as const };

  const trimmed = body.trim();
  if (!trimmed) {
    return { error: "conflict" as const, message: "Write a message before sending." };
  }
  if (trimmed.length > 1200) {
    return { error: "conflict" as const, message: "That message is too long." };
  }
  if (!isSmsConfigured()) return { error: "misconfigured" as const };

  const sent = await sendSms({
    to: conversation.phone_number,
    body: buildStaffCustomerSms(trimmed),
  });
  if (!sent) return { error: "server" as const };
  await markConversationRead(conversationId);
  const detail = await getCommunicationDetail(conversationId);
  if (!detail) return { error: "server" as const };
  return { detail };
}

export async function startCommunicationCallback(conversationId: string) {
  const session = await getStaffSession();
  if ("error" in session) return session;
  if (!isConversationId(conversationId)) return { error: "not_found" as const };
  const conversation = await getConversationRecord(conversationId);
  if (!conversation) return { error: "not_found" as const };

  const result = await startStaffOutboundCall({
    phone: conversation.phone_number,
    customerId: conversation.customer_id ?? undefined,
  });
  if ("error" in result) return result;
  await markConversationRead(conversationId);
  return {
    ok: true as const,
    callSid: result.callSid ?? null,
    banner: "Calling…",
  };
}
