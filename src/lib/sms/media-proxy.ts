function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function twilioAccountSid() {
  return envValue("TWILIO_ACCOUNT_SID");
}

export function twilioAuthToken() {
  return envValue("TWILIO_AUTH_TOKEN");
}

/** Only Twilio media for this account may be proxied to the staff browser. */
export function isAllowedTwilioMediaUrl(rawUrl: string, accountSid = twilioAccountSid()) {
  if (!accountSid) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (url.hostname !== "api.twilio.com") return false;
    const prefix = `/2010-04-01/Accounts/${accountSid}/`;
    return url.pathname.startsWith(prefix) && url.pathname.includes("/Media/");
  } catch {
    return false;
  }
}

export async function fetchTwilioMedia(mediaUrl: string): Promise<Response | null> {
  const accountSid = twilioAccountSid();
  const authToken = twilioAuthToken();
  if (!accountSid || !authToken || !isAllowedTwilioMediaUrl(mediaUrl, accountSid)) {
    return null;
  }

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Twilio media fetch failed:", response.status, mediaUrl);
    return null;
  }
  return response;
}
