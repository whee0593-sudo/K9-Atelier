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
}): Promise<boolean> {
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
    const errorText = await response.text();
    console.error("Twilio SMS failed:", response.status, errorText);
    return false;
  }

  return true;
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

  if (mediaUrls.length > 0) {
    const sentMms = fromNumber
      ? await postTwilioMessage({
          ...shared,
          from: fromNumber,
          mediaUrls,
        })
      : await postTwilioMessage({
          ...shared,
          messagingServiceSid,
          mediaUrls,
        });
    if (sentMms) return true;
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
}
