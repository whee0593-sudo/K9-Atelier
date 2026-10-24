import { business } from "@/lib/business";
import { siteUrl as buildSiteUrl } from "@/lib/email/site-url";
import { communicationToDelivery } from "@/lib/communications/delivery";
import { dispatchCommunication } from "@/lib/communications/dispatch";
import {
  providerHttpResult,
  uncertainProviderError,
} from "@/lib/communications/provider-outcome";
import {
  isCommunicationAccepted,
  type CommunicationSendResult,
} from "@/lib/communications/result";
import type { CommunicationContext } from "@/lib/communications/types";
import { isValidEmail } from "@/lib/support-contact";
import type { ProviderDelivery } from "@/lib/visits/provider-delivery";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  from?: string;
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

export async function postResend(input: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  replyTo: string | null;
}): Promise<
  ReturnType<typeof providerHttpResult> | ReturnType<typeof uncertainProviderError>
> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { outcome: "rejected", errorMessage: "RESEND_API_KEY is not configured" };
  }

  const payload: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;
  if (input.replyTo) payload.reply_to = input.replyTo;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let providerMessageId: string | null = null;
    if (response.ok) {
      try {
        const parsed = JSON.parse(raw) as { id?: unknown };
        providerMessageId = typeof parsed.id === "string" ? parsed.id : null;
      } catch {
        providerMessageId = null;
      }
    }
    return providerHttpResult({
      status: response.status,
      raw,
      providerMessageId,
    });
  } catch (error) {
    return uncertainProviderError(error);
  }
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<CommunicationSendResult> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((value) => value.trim())
    .filter(Boolean);
  const from = input.from?.trim() || getFromEmail();

  return dispatchCommunication({
    channel: "email",
    provider: "resend",
    recipient: recipients.join(", "),
    subject: input.subject,
    bodyText: input.text,
    bodyHtml: input.html ?? null,
    replyTo: input.replyTo ?? null,
    context: input.communication ?? null,
    configured: isEmailConfigured() && Boolean(from),
    recipientValid:
      recipients.length > 0 && recipients.every((value) => isValidEmail(value)),
    send: (snapshot) =>
      postResend({
        from,
        to: snapshot.recipient
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        subject: snapshot.subject ?? input.subject,
        text: snapshot.bodyText,
        html: snapshot.bodyHtml,
        replyTo: snapshot.replyTo,
      }),
  });
}

export async function sendEmailDelivery(
  input: SendEmailInput,
): Promise<ProviderDelivery> {
  return communicationToDelivery(await sendEmail(input));
}

export function emailWasAccepted(result: CommunicationSendResult) {
  return isCommunicationAccepted(result);
}

export type TrackedEmailResult =
  | { outcome: "accepted"; providerMessageId: string }
  | { outcome: "failed"; error: string }
  | { outcome: "uncertain"; error: string };

/** Merchant path. `from` is required so the merchant inbox is never the sender. */
export async function sendTrackedEmail(
  input: SendEmailInput & { from: string },
): Promise<TrackedEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { outcome: "failed", error: "RESEND_API_KEY is not configured" };
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const payload: Record<string, unknown> = {
    from: input.from,
    to: recipients,
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;
  if (input.replyTo) payload.reply_to = input.replyTo;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    if (!response.ok) {
      const error = `Resend ${response.status}`;
      return response.status >= 500
        ? { outcome: "uncertain", error }
        : { outcome: "failed", error };
    }
    let providerMessageId = "";
    try {
      const parsed = JSON.parse(body) as { id?: unknown };
      if (typeof parsed.id === "string") providerMessageId = parsed.id;
    } catch {
      providerMessageId = "";
    }
    if (!providerMessageId) {
      return { outcome: "uncertain", error: "Resend response did not include an id" };
    }
    return { outcome: "accepted", providerMessageId };
  } catch {
    return { outcome: "uncertain", error: "Resend request did not finish" };
  }
}

export function siteUrl(path: string) {
  return buildSiteUrl(path);
}
