import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/email/resend";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

const TOKEN_TTL_MS = 3 * 60 * 1000;

function signingSecret() {
  return (
    process.env.TWILIO_AUTH_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

function sign(to: string, exp: number) {
  return createHmac("sha256", signingSecret())
    .update(`${to}.${exp}`)
    .digest("hex")
    .slice(0, 32);
}

export function buildVoiceBridgeUrl(customerNumber: string) {
  const to = normalizePhoneToE164(customerNumber);
  if (!to) return null;
  const exp = Date.now() + TOKEN_TTL_MS;
  const params = new URLSearchParams({
    to,
    exp: String(exp),
    sig: sign(to, exp),
  });
  return `${siteUrl("/api/voice/bridge")}?${params.toString()}`;
}

export function readVoiceBridgeTarget(input: {
  to?: string;
  exp?: string;
  sig?: string;
}): string | null {
  const to = input.to ? normalizePhoneToE164(input.to) : null;
  const exp = Number(input.exp);
  const sig = input.sig?.trim() ?? "";
  if (!to || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = sign(to, exp);
  const left = Buffer.from(expected);
  const right = Buffer.from(sig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return to;
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildConnectCustomerTwiml(
  customerNumber: string,
  callerId: string,
) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Connecting you to the customer.</Say><Dial callerId="${escapeXml(callerId)}" answerOnBridge="true"><Number>${escapeXml(customerNumber)}</Number></Dial></Response>`;
}

export function buildVoiceErrorTwiml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say></Response>`;
}
