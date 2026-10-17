import { createHash } from "node:crypto";
import { redactCommunicationSecrets } from "@/lib/communications/redact";

/** Stable correlation value that does not contain the recipient or the body. */
export function communicationAlertKey(idempotencyKey: string) {
  return createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
}

/** Alert text must not carry the message body, links, payment data, or contact details. */
export function safeAlertMessage(message: string) {
  return redactCommunicationSecrets(message)
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+\d[\d\s().-]{7,}\d/g, "[phone]")
    .slice(0, 300);
}
