import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/email/resend";
import type { CustomerByPhone } from "@/lib/sms/customer-by-phone";
import { formatPetAndOwnerLabel } from "@/lib/sms/inbox-copy";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { getStaffVoicePhone } from "@/lib/voice/config";
import { escapeXml } from "@/lib/voice/bridge";

const TOKEN_TTL_MS = 2 * 60 * 1000;

export type IncomingCaller = {
  phone: string;
  customer: CustomerByPhone | null;
};

function signingSecret() {
  return (
    process.env.TWILIO_AUTH_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

function sign(say: string, exp: number) {
  return createHmac("sha256", signingSecret())
    .update(`${say}.${exp}`)
    .digest("hex")
    .slice(0, 32);
}

export function callerLabel(caller: IncomingCaller) {
  if (!caller.customer) return "an unknown number";
  return formatPetAndOwnerLabel({
    firstName: caller.customer.firstName,
    petNames: caller.customer.petNames,
  });
}

export function buildIncomingCallSms(caller: IncomingCaller) {
  return `K9 ATELIER incoming: ${callerLabel(caller)} ${caller.phone}`;
}

export function buildWhisperSay(caller: IncomingCaller) {
  if (!caller.customer) {
    return "K9 Atelier transfer. Call from an unknown number.";
  }
  const pets = caller.customer.petNames;
  if (pets.length > 0) {
    return `K9 Atelier transfer. Call from ${caller.customer.firstName}. Pets: ${pets.join(", ")}.`;
  }
  return `K9 Atelier transfer. Call from ${caller.customer.firstName}.`;
}

export function buildWhisperUrl(say: string) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const params = new URLSearchParams({
    say,
    exp: String(exp),
    sig: sign(say, exp),
  });
  return `${siteUrl("/api/voice/whisper")}?${params.toString()}`;
}

export function readWhisperSay(input: {
  say?: string;
  exp?: string;
  sig?: string;
}): string | null {
  const say = input.say?.trim() ?? "";
  const exp = Number(input.exp);
  const sig = input.sig?.trim() ?? "";
  if (!say || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = sign(say, exp);
  const left = Buffer.from(expected);
  const right = Buffer.from(sig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  return say;
}

export function buildWhisperTwiml(say: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(say)}</Say></Response>`;
}

export const MISSED_CALL_FALLBACK_SAY =
  "We could not reach K9 Atelier. Please text this number or email penny@k9atelier.com.";

export function shouldSendMissedCallSms(dialCallStatus: string) {
  return ["busy", "no-answer", "failed", "canceled"].includes(
    dialCallStatus.trim().toLowerCase(),
  );
}

export function buildForwardCallTwiml(
  staffPhone: string,
  whisperUrl: string,
  studioCallerId: string,
  actionUrl?: string,
) {
  const action = actionUrl ? ` action="${escapeXml(actionUrl)}"` : "";
  const fallback = actionUrl
    ? ""
    : `<Say>${escapeXml(MISSED_CALL_FALLBACK_SAY)}</Say>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial${action} callerId="${escapeXml(studioCallerId)}" timeout="25" answerOnBridge="true"><Number url="${escapeXml(whisperUrl)}">${escapeXml(staffPhone)}</Number></Dial>${fallback}</Response>`;
}

export function isStaffCallingStudio(from: string) {
  const staff = getStaffVoicePhone();
  const incoming = normalizePhoneToE164(from);
  return Boolean(staff && incoming && staff === incoming);
}
