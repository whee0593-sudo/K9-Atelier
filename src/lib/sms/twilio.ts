import {
  classifyProviderHttpStatus,
  type ProviderDelivery,
} from "@/lib/visits/provider-delivery";

export type SendSmsInput = {
  to: string;
  body: string;
  mediaUrls?: string[];
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
}): Promise<ProviderDelivery> {
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

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("Twilio SMS failed:", response.status, errorText);
    return classifyProviderHttpStatus(response.status);
  }

  return "delivered";
}

function twilioRequest(input: SendSmsInput) {
  const accountSid = envValue("TWILIO_ACCOUNT_SID");
  const authToken = envValue("TWILIO_AUTH_TOKEN");
  const fromNumber = envValue("TWILIO_FROM_NUMBER");
  const messagingServiceSid = envValue("TWILIO_MESSAGING_SERVICE_SID");
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return null;
  }
  const mediaUrls = (input.mediaUrls ?? []).map((url) => url.trim()).filter(Boolean);
  return {
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
    mediaUrls,
    shared: {
      accountSid,
      authToken,
      to: input.to,
      body: input.body || (mediaUrls.length ? "Photo" : ""),
    },
  };
}

function textMessage(
  request: NonNullable<ReturnType<typeof twilioRequest>>,
) {
  return postTwilioMessage({
    ...request.shared,
    from: request.messagingServiceSid ? undefined : request.fromNumber || undefined,
    messagingServiceSid: request.messagingServiceSid || undefined,
  });
}

async function mediaMessage(
  request: NonNullable<ReturnType<typeof twilioRequest>>,
) {
  return request.fromNumber
    ? postTwilioMessage({
        ...request.shared,
        from: request.fromNumber,
        mediaUrls: request.mediaUrls,
      })
    : postTwilioMessage({
        ...request.shared,
        messagingServiceSid: request.messagingServiceSid,
        mediaUrls: request.mediaUrls,
      });
}

export async function sendSms(input: SendSmsInput): Promise<boolean> {
  const request = twilioRequest(input);
  if (!request) {
    console.warn("sendSms skipped: Twilio is not configured");
    return false;
  }
  if (request.mediaUrls.length > 0) {
    const sentMms = await mediaMessage(request);
    if (sentMms === "delivered") return true;
    console.warn("Twilio MMS failed; sending text without the image");
    return (await textMessage(request)) === "delivered";
  }
  return (await textMessage(request)) === "delivered";
}

/** Visit notices use this so a timeout is not treated as a clean rejection. */
export async function sendSmsDelivery(
  input: SendSmsInput,
): Promise<ProviderDelivery> {
  const request = twilioRequest(input);
  if (!request) {
    console.warn("sendSms skipped: Twilio is not configured");
    return "rejected";
  }
  try {
    if (request.mediaUrls.length > 0) {
      const sentMms = await mediaMessage(request);
      if (sentMms !== "rejected") return sentMms;
      console.warn("Twilio MMS failed; sending text without the image");
    }
    return await textMessage(request);
  } catch (error) {
    console.error("Twilio SMS outcome uncertain:", error);
    return "uncertain";
  }
}
