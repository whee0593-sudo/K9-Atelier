import type { ProviderAttempt } from "@/lib/communications/types";

export function classifyProviderHttp(input: {
  ok: boolean;
  status: number;
  providerMessageId: string | null;
}): ProviderAttempt {
  if (input.ok && input.providerMessageId) {
    return { outcome: "accepted", providerMessageId: input.providerMessageId };
  }
  if (input.ok) {
    return { outcome: "uncertain", error: "provider id missing" };
  }
  if (input.status >= 400 && input.status < 500) {
    return { outcome: "failed", error: `provider rejected ${input.status}` };
  }
  return {
    outcome: "uncertain",
    error: `provider status ${input.status || "unknown"}`,
  };
}

type TrackedEmailInput = {
  from?: string;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  replyTo?: string | null;
};

export async function sendTrackedEmail(
  input: TrackedEmailInput,
): Promise<ProviderAttempt | { outcome: "skipped"; reason: "missing_config" }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { outcome: "skipped", reason: "missing_config" };

  const payload: Record<string, unknown> = {
    from:
      input.from?.trim() ||
      process.env.SUPPORT_FROM_EMAIL?.trim() ||
      "K9 Atelier <penny@k9atelier.com>",
    to: [input.to],
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;
  if (input.replyTo) payload.reply_to = input.replyTo;

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
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    if (typeof parsed.id === "string" && parsed.id.trim()) {
      providerMessageId = parsed.id.trim();
    }
  } catch {
    providerMessageId = null;
  }
  return classifyProviderHttp({
    ok: response.ok,
    status: response.status,
    providerMessageId,
  });
}

export async function sendTrackedSms(input: {
  to: string;
  body: string;
}): Promise<ProviderAttempt | { outcome: "skipped"; reason: "missing_config" }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() ?? "";
  const messagingServiceSid =
    process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? "";
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return { outcome: "skipped", reason: "missing_config" };
  }

  const params = new URLSearchParams();
  params.set("To", input.to);
  params.set("Body", input.body);
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else params.set("From", fromNumber);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  const raw = await response.text();
  let providerMessageId: string | null = null;
  try {
    const parsed = JSON.parse(raw) as { sid?: unknown };
    if (typeof parsed.sid === "string" && parsed.sid.trim()) {
      providerMessageId = parsed.sid.trim();
    }
  } catch {
    providerMessageId = null;
  }
  return classifyProviderHttp({
    ok: response.ok,
    status: response.status,
    providerMessageId,
  });
}

export function asProviderAttempt(
  result: ProviderAttempt | { outcome: "skipped"; reason: "missing_config" },
): ProviderAttempt {
  if (result.outcome === "skipped") {
    return { outcome: "failed", error: "missing_config" };
  }
  return result;
}
