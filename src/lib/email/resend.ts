import { business } from "@/lib/business";
import { dispatchCommunication } from "@/lib/communications/dispatch";
import type { CommunicationSendResult } from "@/lib/communications/result";
import type { CommunicationContext } from "@/lib/communications/types";
import { isValidEmail } from "@/lib/support-contact";

export type SendEmailAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: SendEmailAttachment[];
  communication?: CommunicationContext;
};

function getFromEmail() {
  return (
    process.env.SUPPORT_FROM_EMAIL?.trim() ||
    `K9 Atelier <${business.brand.email}>`
  );
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

async function postResend(input: {
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  replyTo: string | null;
  attachments?: SendEmailAttachment[];
}): Promise<
  | { ok: true; providerMessageId: string | null }
  | { ok: false; errorMessage: string }
> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, errorMessage: "RESEND_API_KEY is not configured" };
  }

  const payload: Record<string, unknown> = {
    from: getFromEmail(),
    to: input.to,
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.attachments?.length) {
    payload.attachments = input.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      content_type: attachment.contentType,
    }));
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  if (!response.ok) {
    return { ok: false, errorMessage: `${response.status} ${raw}` };
  }
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    const id = typeof parsed.id === "string" ? parsed.id : null;
    return { ok: true, providerMessageId: id };
  } catch {
    return { ok: true, providerMessageId: null };
  }
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<CommunicationSendResult> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((value) => value.trim())
    .filter(Boolean);

  return dispatchCommunication({
    channel: "email",
    provider: "resend",
    recipient: recipients.join(", "),
    subject: input.subject,
    bodyText: input.text,
    bodyHtml: input.html ?? null,
    replyTo: input.replyTo ?? null,
    context: input.communication ?? null,
    configured: isEmailConfigured(),
    recipientValid:
      recipients.length > 0 && recipients.every((value) => isValidEmail(value)),
    send: (snapshot) =>
      postResend({
        to: snapshot.recipient.split(",").map((value) => value.trim()).filter(Boolean),
        subject: snapshot.subject ?? input.subject,
        text: snapshot.bodyText,
        html: snapshot.bodyHtml,
        replyTo: snapshot.replyTo,
        attachments: input.attachments,
      }),
  });
}

export function siteUrl(path: string) {
  const base = business.brand.website?.replace(/\/$/, "") ?? "https://k9atelier.com";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
