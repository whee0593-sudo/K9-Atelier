import { siteUrl } from "@/lib/email/resend";

export type SendSmsInput = {
  to: string;
  body: string;
  mediaUrls?: string[];
};

type TwilioMessageResult = {
  sid: string;
  status: string;
  from: string;
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
}): Promise<TwilioMessageResult | null> {
  const params = new URLSearchParams();
  params.set("To", input.to);
  params.set("Body", input.body);
  params.set("StatusCallback", siteUrl("/api/sms/status"));
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Twilio SMS failed:", response.status, errorText);
    return null;
  }

  const payload = (await response.json().catch(() => null)) as {
    sid?: string;
    status?: string;
    from?: string;
  } | null;
  return {
    sid: payload?.sid?.trim() ?? "",
    status: payload?.status?.trim() || "queued",
    from: payload?.from?.trim() ?? "",
  };
}

export async function sendSms(input: SendSmsInput): Promise<boolean> {
  const accountSid = envValue("TWILIO_ACCOUNT_SID");
  const authToken = envValue("TWILIO_AUTH_TOKEN");
  const fromNumber = envValue("TWILIO_FROM_NUMBER");
  const messagingServiceSid = envValue("TWILIO_MESSAGING_SERVICE_SID");

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    console.warn("sendSms skipped: Twilio is not configured");
    return false;
  }

  const mediaUrls = (input.mediaUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const shared = {
    accountSid,
    authToken,
    to: input.to,
    body: input.body || (mediaUrls.length ? "Photo" : ""),
  };

  const sent = mediaUrls.length
    ? await sendWithMediaFallback({
        shared,
        fromNumber,
        messagingServiceSid,
        mediaUrls,
      })
    : await postTwilioMessage({
        ...shared,
        from: messagingServiceSid ? undefined : fromNumber || undefined,
        messagingServiceSid: messagingServiceSid || undefined,
      });

  if (sent) {
    await rememberOutboundMessage({
      to: input.to,
      from: sent.from || fromNumber,
      body: shared.body,
      messageSid: sent.sid,
      status: sent.status,
    });
  }
  return Boolean(sent);
}

async function sendWithMediaFallback(input: {
  shared: {
    accountSid: string;
    authToken: string;
    to: string;
    body: string;
  };
  fromNumber: string;
  messagingServiceSid: string;
  mediaUrls: string[];
}) {
  const sentMms = input.fromNumber
    ? await postTwilioMessage({
        ...input.shared,
        from: input.fromNumber,
        mediaUrls: input.mediaUrls,
      })
    : await postTwilioMessage({
        ...input.shared,
        messagingServiceSid: input.messagingServiceSid,
        mediaUrls: input.mediaUrls,
      });
  if (sentMms) return sentMms;
  console.warn("Twilio MMS failed; sending text without the image");
  return postTwilioMessage({
    ...input.shared,
    from: input.fromNumber || undefined,
    messagingServiceSid: input.fromNumber ? undefined : input.messagingServiceSid,
  });
}

async function rememberOutboundMessage(input: {
  to: string;
  from: string;
  body: string;
  messageSid: string;
  status: string;
}) {
  try {
    const { phonesMatch } = await import("@/lib/sms/phone");
    const { getStaffVoicePhone } = await import("@/lib/voice/config");
    if (phonesMatch(input.to, getStaffVoicePhone())) return;
    const { recordOutboundMessage } = await import("@/lib/communication/store");
    await recordOutboundMessage({
      messageSid: input.messageSid,
      from: input.from,
      to: input.to,
      body: input.body,
      status: input.status,
    });
  } catch (error) {
    console.error("record outbound communication failed:", error);
  }
}
