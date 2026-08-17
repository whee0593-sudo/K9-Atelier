export type SendSmsInput = {
  to: string;
  body: string;
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

export async function sendSms(input: SendSmsInput): Promise<boolean> {
  const accountSid = envValue("TWILIO_ACCOUNT_SID");
  const authToken = envValue("TWILIO_AUTH_TOKEN");
  const fromNumber = envValue("TWILIO_FROM_NUMBER");
  const messagingServiceSid = envValue("TWILIO_MESSAGING_SERVICE_SID");

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    console.warn("sendSms skipped: Twilio is not configured");
    return false;
  }

  const params = new URLSearchParams();
  params.set("To", input.to);
  params.set("Body", input.body);
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else {
    params.set("From", fromNumber);
  }

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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Twilio SMS failed:", response.status, errorText);
    return false;
  }

  return true;
}
