import { normalizePhoneToE164 } from "@/lib/sms/phone";

export function splitStaffReply(body: string): {
  phone: string | null;
  message: string;
} {
  const trimmed = body.trim();
  const match = trimmed.match(/^(\+?1?\d{10,15})(?:\s+|:\s*)([\s\S]+)$/);
  if (!match) return { phone: null, message: trimmed };
  const phone = normalizePhoneToE164(match[1]);
  if (!phone) return { phone: null, message: trimmed };
  return { phone, message: match[2].trim() };
}

export function buildStaffReplySentSms(label: string) {
  return `K9 ATELIER: Sent to ${label}.`;
}

export function buildStaffReplyFailedSms() {
  return "K9 ATELIER: No recent customer to reply to. Use Contact Customer on the website.";
}
