import { dispatchCommunication } from "@/lib/communications/dispatch";
import type { CommunicationSendResult } from "@/lib/communications/result";
import type { CommunicationContext } from "@/lib/communications/types";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

export type SendSmsInput = {
  to: string;
  body: string;
  mediaUrls?: string[];
  communication?: CommunicationContext;
};

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isSmsConfigured() {
  return Boolean(
    envValue("TWILIO_ACCOUNT_SID") &&
      envValue("TWILIO_AUTH_TOKEN") &&
      (envValue("TWILIO_FROM_NUMBER") || envValue("TWILIO_MESSAGING_SERVICE_SID")),
  );
}

async function postTwilioMessage(input: {
  accountSid: string;
  authToken: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  from?: string;
  messagingServiceSid?: string;
}): Promise<
  | { ok: true; providerMessageId: string | null }
  | { ok: false; errorMessage: string }
> {
  const params = new URLSearchParams();
  params.set("To", input.to);
  params.set("Body", input.body);
  for (const url of input.mediaUrls ?? []) {
    if (url.trim()) params.append("MediaUrl", url.trim());
  }
  if (input.from) {
    params.set("From", input.from);
  } else if (input.messagingServiceSid) {
    params.set("MessagingServiceSid", input.messagingServiceSid);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  const raw = await response.text();
  if (!response.ok) {
    return { ok: false, errorMessage: `${response.status} ${raw}` };
  }
  try {
    const parsed = JSON.parse(raw) as { sid?: unknown };
    const sid = typeof parsed.sid === "string" ? parsed.sid : null;
    return { ok: true, providerMessageId: sid };
  } catch {
    return { ok: true, providerMessageId: null };
  }
}

export async function sendSms(
  input: SendSmsInput,
): Promise<CommunicationSendResult> {
  const accountSid = envValue("TWILIO_ACCOUNT_SID");
  const authToken = envValue("TWILIO_AUTH_TOKEN");
  const fromNumber = envValue("TWILIO_FROM_NUMBER");
  const messagingServiceSid = envValue("TWILIO_MESSAGING_SERVICE_SID");
  const to = normalizePhoneToE164(input.to);
  const mediaUrls = (input.mediaUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const body = input.body || (mediaUrls.length ? "Photo" : "");

  return dispatchCommunication({
    channel: "sms",
    provider: "twilio",
    recipient: to ?? input.to.trim(),
    subject: null,
    bodyText: body,
    bodyHtml: null,
    context: input.communication ?? null,
    configured: Boolean(
      accountSid && authToken && (fromNumber || messagingServiceSid),
    ),
    recipientValid: Boolean(to) && Boolean(body),
    send: async (snapshot) => {
      const shared = {
        accountSid,
        authToken,
        to: snapshot.recipient,
        body: snapshot.bodyText,
      };
      if (mediaUrls.length > 0) {
        const sentMms = fromNumber
          ? await postTwilioMessage({ ...shared, from: fromNumber, mediaUrls })
          : await postTwilioMessage({
              ...shared,
              messagingServiceSid,
              mediaUrls,
            });
        if (sentMms.ok) return sentMms;
        console.warn("Twilio MMS failed; sending text without the image");
        return postTwilioMessage({
          ...shared,
          from: fromNumber || undefined,
          messagingServiceSid: fromNumber ? undefined : messagingServiceSid,
        });
      }
      return postTwilioMessage({
        ...shared,
        from: messagingServiceSid ? undefined : fromNumber || undefined,
        messagingServiceSid: messagingServiceSid || undefined,
      });
    },
  });
}
